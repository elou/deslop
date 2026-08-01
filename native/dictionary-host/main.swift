import CoreServices
import Foundation

private struct DictionaryRequest: Decodable {
  let type: String
  let term: String
}

private struct DictionaryResponse: Encodable {
  let ok: Bool
  let definition: String?
  let source: String?
  let error: String?
}

private let input = FileHandle.standardInput
private let output = FileHandle.standardOutput
private let decoder = JSONDecoder()
private let encoder = JSONEncoder()

private func readExactly(_ byteCount: Int) -> Data? {
  var data = Data()
  while data.count < byteCount {
    let chunk = input.readData(ofLength: byteCount - data.count)
    if chunk.isEmpty { return data.isEmpty ? nil : data }
    data.append(chunk)
  }
  return data
}

private func writeResponse(_ response: DictionaryResponse) {
  guard let payload = try? encoder.encode(response) else { return }
  var length = UInt32(payload.count).littleEndian
  output.write(Data(bytes: &length, count: MemoryLayout<UInt32>.size))
  output.write(payload)
}

private func definition(for term: String) -> String? {
  let dictionaryTerm = term.withCString {
    CFStringCreateWithCString(nil, $0, CFStringBuiltInEncodings.UTF8.rawValue)
  }
  guard let dictionaryTerm else { return nil }
  let range = CFRange(
    location: 0,
    length: CFStringGetLength(dictionaryTerm)
  )
  guard let value = DCSCopyTextDefinition(nil, dictionaryTerm, range)?.takeRetainedValue()
  else { return nil }
  return value as String
}

while let header = readExactly(MemoryLayout<UInt32>.size) {
  guard header.count == MemoryLayout<UInt32>.size else { break }
  let messageLength = header.withUnsafeBytes {
    Int($0.loadUnaligned(as: UInt32.self).littleEndian)
  }
  guard messageLength > 0, messageLength <= 1_048_576,
        let payload = readExactly(messageLength), payload.count == messageLength
  else {
    writeResponse(DictionaryResponse(
      ok: false,
      definition: nil,
      source: nil,
      error: "Invalid native message"
    ))
    continue
  }

  guard let request = try? decoder.decode(DictionaryRequest.self, from: payload),
        request.type == "define"
  else {
    writeResponse(DictionaryResponse(
      ok: false,
      definition: nil,
      source: nil,
      error: "Unsupported request"
    ))
    continue
  }

  let term = request.term.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !term.isEmpty, let result = definition(for: term) else {
    writeResponse(DictionaryResponse(
      ok: false,
      definition: nil,
      source: nil,
      error: "No system dictionary match"
    ))
    continue
  }

  writeResponse(DictionaryResponse(
    ok: true,
    definition: result,
    source: "macOS Dictionary",
    error: nil
  ))
}
