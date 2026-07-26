"""git filter-branch --msg-filter helper: drop Claude/Anthropic signatures."""
import sys

data = sys.stdin.buffer.read().decode("utf-8", "replace")
out = []
for line in data.split("\n"):
    low = line.lower()
    if low.startswith("co-authored-by:") and ("claude" in low or "anthropic" in low):
        continue
    if "generated with [claude code]" in low:
        continue
    if line.strip() == "\U0001f916":
        continue
    out.append(line)

while out and not out[-1].strip():
    out.pop()

sys.stdout.buffer.write(("\n".join(out) + "\n").encode("utf-8"))
