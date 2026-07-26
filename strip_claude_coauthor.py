if commit.original_id == b"c7502b3f92a81fbecf6cb82f1521b27ca03741eb":
    lines = commit.message.split(b"\n")
    filtered = [l for l in lines if b"Claude Sonnet" not in l]
    while filtered and filtered[-1] == b"":
        filtered.pop()
    commit.message = b"\n".join(filtered) + b"\n"
