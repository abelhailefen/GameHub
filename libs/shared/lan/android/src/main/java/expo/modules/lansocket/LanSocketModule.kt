package expo.modules.lansocket

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.IOException
import java.io.InputStreamReader
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Plain TCP text sockets for LAN games: a server that accepts connections and clients that
 * connect to it. Each socket gets a numeric id; JS writes strings and receives "onData" events.
 */
class LanSocketModule : Module() {
  private val nextId = AtomicInteger(1)
  private val servers = ConcurrentHashMap<Int, ServerSocket>()
  private val connections = ConcurrentHashMap<Int, Connection>()

  @Volatile private var beaconSocket: DatagramSocket? = null
  @Volatile private var listenSocket: DatagramSocket? = null
  private var multicastLock: WifiManager.MulticastLock? = null

  /** IPv4 addresses of this phone's active network interfaces (Wi-Fi, hotspot…), excluding loopback. */
  private fun ipv4Interfaces(): List<Triple<String, Inet4Address, Short>> {
    val out = mutableListOf<Triple<String, Inet4Address, Short>>()
    for (nic in NetworkInterface.getNetworkInterfaces()?.toList() ?: emptyList()) {
      if (!nic.isUp || nic.isLoopback) continue
      for (ia in nic.interfaceAddresses) {
        val addr = ia.address
        if (addr is Inet4Address) out.add(Triple(nic.name, addr, ia.networkPrefixLength))
      }
    }
    return out
  }

  private fun broadcastTargets(): List<InetAddress> {
    val targets = mutableListOf<InetAddress>(InetAddress.getByName("255.255.255.255"))
    for (nic in NetworkInterface.getNetworkInterfaces()?.toList() ?: emptyList()) {
      if (!nic.isUp || nic.isLoopback) continue
      for (ia in nic.interfaceAddresses) ia.broadcast?.let { targets.add(it) }
    }
    return targets
  }

  private fun stopBeaconNow() {
    beaconSocket?.let { closeQuietly(it) }
    beaconSocket = null
  }

  private fun stopDiscoveryNow() {
    listenSocket?.let { closeQuietly(it) }
    listenSocket = null
    try {
      multicastLock?.let { if (it.isHeld) it.release() }
    } catch (_: Exception) {
    }
    multicastLock = null
  }

  private fun emit(name: String, fill: Bundle.() -> Unit) {
    sendEvent(name, Bundle().apply(fill))
  }

  private inner class Connection(val id: Int) {
    @Volatile private var socket: Socket? = null
    private val outbox = LinkedBlockingQueue<String>()
    private val closing = AtomicBoolean(false)
    private val closed = AtomicBoolean(false)

    /** Starts reading and writing once the socket is connected. */
    fun start(s: Socket) {
      socket = s
      if (closed.get()) {
        closeQuietly(s)
        return
      }
      s.tcpNoDelay = true
      Thread({ readLoop(s) }, "lan-read-$id").start()
      Thread({ writeLoop(s) }, "lan-write-$id").start()
    }

    val isClosed get() = closed.get()

    fun write(data: String) {
      if (!closing.get()) outbox.offer(data)
    }

    /** Close after everything already written has been sent. */
    fun closeGracefully() {
      if (!closing.compareAndSet(false, true)) return
      if (socket == null) closeNow() else outbox.offer(END)
    }

    fun closeNow() {
      if (!closed.compareAndSet(false, true)) return
      closing.set(true)
      outbox.offer(END)
      socket?.let { closeQuietly(it) }
      connections.remove(id)
      emit("onClose") { putInt("id", id) }
    }

    private fun readLoop(s: Socket) {
      try {
        val reader = InputStreamReader(s.getInputStream(), Charsets.UTF_8)
        val buffer = CharArray(8192)
        while (true) {
          val n = reader.read(buffer)
          if (n < 0) break
          val text = String(buffer, 0, n)
          emit("onData") {
            putInt("id", id)
            putString("data", text)
          }
        }
      } catch (_: IOException) {
      }
      closeNow()
    }

    private fun writeLoop(s: Socket) {
      try {
        val out = s.getOutputStream()
        while (!closed.get()) {
          val message = outbox.poll(1, TimeUnit.SECONDS) ?: continue
          if (message === END) break
          out.write(message.toByteArray(Charsets.UTF_8))
          out.flush()
        }
      } catch (_: Exception) {
      }
      closeNow()
    }
  }

  override fun definition() = ModuleDefinition {
    Name("LanSocket")

    Events("onConnection", "onConnect", "onData", "onClose", "onBeacon")

    /** Active IPv4 addresses, e.g. [{ name: "wlan0", address: "192.168.1.5", prefix: 24 }]. */
    Function("addresses") {
      ipv4Interfaces().map { (name, addr, prefix) ->
        mapOf("name" to name, "address" to (addr.hostAddress ?: ""), "prefix" to prefix.toInt())
      }
    }

    /** Host: announce the game by UDP broadcast every second until stopBeacon. */
    Function("startBeacon") { port: Int, message: String ->
      stopBeaconNow()
      val socket = DatagramSocket()
      socket.broadcast = true
      beaconSocket = socket
      val bytes = message.toByteArray(Charsets.UTF_8)
      Thread({
        while (beaconSocket === socket) {
          for (target in try { broadcastTargets() } catch (_: Exception) { emptyList() }) {
            try {
              socket.send(DatagramPacket(bytes, bytes.size, target, port))
            } catch (_: Exception) {
            }
          }
          try {
            Thread.sleep(1000)
          } catch (_: InterruptedException) {
            break
          }
        }
      }, "lan-beacon").start()
    }

    Function("stopBeacon") {
      stopBeaconNow()
    }

    /** Joining phone: listen for hosts' broadcasts. Emits onBeacon { address, data }. */
    Function("startDiscovery") { port: Int ->
      stopDiscoveryNow()
      try {
        val wifi = appContext.reactContext?.applicationContext?.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        multicastLock = wifi?.createMulticastLock("imposter-lan")?.apply {
          setReferenceCounted(false)
          acquire()
        }
      } catch (_: Exception) {
      }
      val socket = DatagramSocket(null)
      socket.reuseAddress = true
      socket.broadcast = true
      socket.bind(InetSocketAddress("0.0.0.0", port))
      listenSocket = socket
      Thread({
        val buffer = ByteArray(2048)
        while (listenSocket === socket) {
          val packet = DatagramPacket(buffer, buffer.size)
          try {
            socket.receive(packet)
          } catch (_: Exception) {
            break
          }
          val from = packet.address?.hostAddress ?: continue
          val text = String(packet.data, 0, packet.length, Charsets.UTF_8)
          emit("onBeacon") {
            putString("address", from)
            putString("data", text)
          }
        }
      }, "lan-discovery").start()
    }

    Function("stopDiscovery") {
      stopDiscoveryNow()
    }

    /** Starts a server on all interfaces. Resolves with the server id; rejects if the port is taken. */
    AsyncFunction("listen") { port: Int ->
      val server = ServerSocket()
      server.reuseAddress = true
      server.bind(InetSocketAddress("0.0.0.0", port))
      val serverId = nextId.getAndIncrement()
      servers[serverId] = server
      Thread({
        while (!server.isClosed) {
          val socket = try {
            server.accept()
          } catch (_: IOException) {
            break
          }
          val connection = Connection(nextId.getAndIncrement())
          connections[connection.id] = connection
          emit("onConnection") {
            putInt("serverId", serverId)
            putInt("id", connection.id)
          }
          connection.start(socket)
        }
      }, "lan-accept-$serverId").start()
      serverId
    }

    Function("closeServer") { serverId: Int ->
      servers.remove(serverId)?.let { closeQuietly(it) }
    }

    /** Opens a connection in the background. Emits onConnect, or onClose if it fails or times out. */
    Function("connect") { host: String, port: Int, timeoutMs: Int ->
      val connection = Connection(nextId.getAndIncrement())
      connections[connection.id] = connection
      Thread({
        val socket = Socket()
        try {
          socket.connect(InetSocketAddress(host, port), timeoutMs)
        } catch (_: Exception) {
          closeQuietly(socket)
          connection.closeNow()
          return@Thread
        }
        if (connection.isClosed) {
          closeQuietly(socket)
          return@Thread
        }
        emit("onConnect") { putInt("id", connection.id) }
        connection.start(socket)
      }, "lan-connect-${connection.id}").start()
      connection.id
    }

    Function("write") { id: Int, data: String ->
      connections[id]?.write(data)
    }

    Function("close") { id: Int ->
      connections[id]?.closeGracefully()
    }

    OnDestroy {
      stopBeaconNow()
      stopDiscoveryNow()
      servers.values.forEach { closeQuietly(it) }
      servers.clear()
      connections.values.toList().forEach { it.closeNow() }
    }
  }

  private companion object {
    /** Marker telling a writer thread to stop. Compared by identity. */
    val END = String(charArrayOf('e', 'n', 'd'))

    fun closeQuietly(c: java.io.Closeable) {
      try {
        c.close()
      } catch (_: Exception) {
      }
    }
  }
}
