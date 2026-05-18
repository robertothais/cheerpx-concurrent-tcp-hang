class TCPClient {
  constructor(readable, writable, opened, closed) {
    this.readable = readable;
    this.writable = writable;
    this.opened = opened;
    this.closed = closed;
  }
  async _close() {
    await this.readable.cancel();
    this.closed.resolve();
  }
}

class TCPServer {
  constructor(readable) {
    this.readable = readable;
    this.closed = Promise.withResolvers();
  }
  async _close() {
    await this.readable.cancel();
    this.closed.resolve();
  }
}

class AcceptQueue {
  constructor() {
    this.queue = [];
    this.waitingResolver = null;
  }
  async pop() {
    let p;
    if (this.queue.length === 0) {
      p = await new Promise((resolve) => {
        this.waitingResolver = resolve;
      });
    } else {
      p = this.queue.shift();
    }
    if (p.open) p.open();
    return p.o;
  }
  push(o, open) {
    const p = { o, open };
    if (this.waitingResolver) {
      this.waitingResolver(p);
      this.waitingResolver = null;
    } else {
      this.queue.push(p);
    }
  }
}

export class StreamNetwork {
  constructor() {
    this.listeners = [];
  }
  cross_streams() {
    const trans1 = new TransformStream();
    const trans2 = new TransformStream();
    const opened = Promise.withResolvers();
    const closed1 = Promise.withResolvers();
    const closed2 = Promise.withResolvers();
    const s1 = new TCPClient(trans1.readable, trans2.writable, opened, closed1);
    const s2 = new TCPClient(trans2.readable, trans1.writable, opened, closed2);
    return [s1, s2];
  }
  makeTCPSocket(client, localAddress, localPort, remoteAddress, remotePort) {
    const {
      readable,
      writable,
      opened: clientOpened,
      closed: clientClosed,
    } = client;
    const openInfo = {
      readable,
      writable,
      remoteAddress,
      remotePort,
      localAddress,
      localPort,
    };
    const opened = clientOpened.promise.then(() => openInfo);
    const closed = clientClosed.promise;
    const close = () => client._close();
    return { opened, closed, close };
  }
  makeTCPServerSocket(s, localAddress, localPort) {
    const openInfo = { readable: s.readable, localAddress, localPort };
    const opened = Promise.resolve(openInfo);
    const closed = s.closed.promise;
    const close = () => s._close();
    return { opened, closed, close };
  }
  TCPSocket(remoteAddress, remotePort) {
    const listener = this.listeners.find(
      (item) =>
        item.addr.port === remotePort &&
        (item.addr.addr === remoteAddress ||
          item.addr.addr === "0.0.0.0" ||
          remoteAddress === "127.0.0.1"),
    );
    if (!listener) {
      return {
        opened: Promise.reject(new Error(`No listener on :${remotePort}`)),
        closed: Promise.reject(new Error("Not connected")),
        close() {},
      };
    }
    const [s1, s2] = this.cross_streams();
    const ret = this.makeTCPSocket(
      s1,
      "127.0.0.1",
      0,
      remoteAddress,
      remotePort,
    );
    const paired = this.makeTCPSocket(
      s2,
      remoteAddress,
      remotePort,
      "127.0.0.1",
      0,
    );
    listener.queue.push(paired, () => s1.opened.resolve());
    return ret;
  }
  TCPServerSocket(localAddress, { localPort }) {
    const queue = new AcceptQueue();
    const readable = new ReadableStream({
      async pull(controller) {
        const o = await queue.pop();
        if (o) controller.enqueue(o);
      },
      cancel: () => queue.push(null, null),
    });
    const server = new TCPServer(readable);
    this.listeners.push({
      addr: { addr: localAddress, port: localPort },
      queue,
    });
    return this.makeTCPServerSocket(server, localAddress, localPort);
  }
  UDPSocket() {
    return null;
  }
  up() {
    return Promise.resolve();
  }
}
