"""PTY relay: forwards the real terminal's keys/mouse to the child and also
injects bytes written to FIFO, so automated checks still render in a real
terminal window."""
import os, pty, sys, select, fcntl, termios, signal, tty
FIFO = os.environ.get("NG_FIFO", "/tmp/ngglide/in.fifo")
if not os.path.exists(FIFO): os.mkfifo(FIFO)
def winsize(fd): return fcntl.ioctl(fd, termios.TIOCGWINSZ, b"\0" * 8)
pid, master = pty.fork()
if pid == 0: os.execvp(sys.argv[1], sys.argv[1:])
fcntl.ioctl(master, termios.TIOCSWINSZ, winsize(0))
def onwinch(*_):
    fcntl.ioctl(master, termios.TIOCSWINSZ, winsize(0)); os.kill(pid, signal.SIGWINCH)
signal.signal(signal.SIGWINCH, onwinch)
old = termios.tcgetattr(0); tty.setraw(0)
fifo = os.open(FIFO, os.O_RDWR | os.O_NONBLOCK)
try:
    while True:
        try: r, _, _ = select.select([0, master, fifo], [], [])
        except InterruptedError: continue
        if master in r:
            try: data = os.read(master, 65536)
            except OSError: break
            if not data: break
            os.write(1, data)
        if 0 in r: os.write(master, os.read(0, 4096))
        if fifo in r:
            d = os.read(fifo, 4096)
            if d: os.write(master, d)
finally:
    termios.tcsetattr(0, termios.TCSADRAIN, old)
    _, st = os.waitpid(pid, 0)
    print("\r\nEXIT", os.waitstatus_to_exitcode(st))
