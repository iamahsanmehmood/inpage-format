# Security

InPage files have been used as weaponized exploit delivery vectors in APT (Advanced Persistent Threat) campaigns. Any library or application that processes InPage files must implement appropriate security measures.

---

## CVE-2017-12824

- **Type**: Stack-based buffer overflow
- **Severity**: Critical (allows remote code execution)
- **Affected**: InPage 3.x (native application)
- **Vector**: Malformed Type2 record in an `InPage100/200/300` stream

### How It Was Exploited

Attackers embedded a malformed InPage record that triggered a stack overflow in the native InPage application on Windows. The overflow overwrote the return address, allowing arbitrary shellcode execution.

The exploit was used in targeted campaigns against Pakistani and Kashmiri civil society organizations, typically delivered as email attachments.

### Detection Markers

Two reliable indicators identify exploit-bearing files:

| Marker | Type | Hex / String |
|---|---|---|
| Egg-hunter stage 1 | 4-byte pattern | `68 72 68 72` |
| Shellcode payload | ASCII string | `LuNdLuNd` |

These markers appear in the raw binary content of the OLE2 container before parsing begins.

---

## Threat Model for a Parsing Library

A library that reads InPage files does not execute native code — it parses binary data in managed memory. This significantly reduces the attack surface compared to the native InPage application. However, parsers have their own risks:

| Threat | Risk | Mitigation |
|---|---|---|
| Specially crafted large file | Memory exhaustion | File size limit (50 MB recommended) |
| Circular FAT chain in OLE2 | Infinite loop | Use a trusted OLE2 library (not a custom parser) |
| Integer overflow in length fields | Buffer overread | Bounds check: offset + length ≤ bufferSize |
| Malformed V3 struct array | Out-of-bounds read | Validate byteLength against remaining buffer |
| XSS via Urdu text in web renderer | Script injection | Escape HTML; use textContent not innerHTML |
| Eval of decoded content | RCE | Never eval decoded text; it is data only |

---

## Recommended Security Checks

Implement these checks **before** parsing the OLE2 container:

### 1. Size Validation

```
if file.length < 512:
  throw "File too small"
if file.length > 50 * 1024 * 1024:
  throw "File too large"
```

### 2. OLE2 Magic Signature

```
magic = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]
if file[0:8] != magic:
  throw "Not a valid InPage file"
```

### 3. Exploit Pattern Scan

```
# Egg-hunter pattern
if bytes [0x68, 0x72, 0x68, 0x72] found anywhere in file:
  throw "SECURITY: Exploit pattern detected (egg-hunter marker)"

# Shellcode string
if "LuNdLuNd" found anywhere in file (ASCII):
  throw "SECURITY: Exploit pattern detected (LuNdLuNd shellcode marker)"
```

### 4. Bounds Checking in the Decoder

Every binary read must validate:
```
if offset + readSize > buffer.length:
  skip or break  # Never read past end of buffer
```

---

## OLE2 Library Trust

The OLE2/CFB container layer should be handled by a well-maintained library, not a custom implementation. Custom OLE2 parsers introduce risk of:
- FAT sector chain cycles (infinite loop)
- Directory entry traversal attacks
- Mini-stream boundary overflows

Trusted OLE2 libraries for each language are listed in `specs/02-container-format.md`.

---

## Client-Side vs. Server-Side Processing

**Client-side (browser/WebAssembly) is safer** for untrusted files because:
- The parsing runs in a sandboxed environment
- No file data is transmitted to a server
- If parsing crashes the tab, no server-side damage occurs

**Server-side processing** should add:
- Process isolation (run parser in a subprocess or container)
- Resource limits (CPU time, memory)
- Input sanitization before passing paths to shell commands

---

## Future Threat Surface

As the format becomes better understood, new attack surfaces may emerge:

- **Embedded object extraction**: If image or OLE embedding extraction is implemented, the extracted binary blobs must be validated before being passed to image decoders (which have their own CVE histories)
- **Font name injection**: Font names are UTF-16LE strings. If rendered to HTML, they must be escaped
- **Color values**: RGB values from the palette are raw bytes; validate range (0–255) before use

---

## References

- [CVE-2017-12824](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2017-12824)
- [Kaspersky Lab analysis of InPage exploits (2016)](https://securelist.com/inpage-exploits-used-against-kashmir-and-uyghur-targets/77325/)
- [OLE2/CFB format specification (Microsoft)](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb)
