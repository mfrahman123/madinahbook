import AppKit
import Foundation
import PDFKit
import Vision

let arguments = CommandLine.arguments
guard arguments.count >= 3 else {
    fputs("Usage: swift tools/ocr_pdf.swift input.pdf output.txt [startPage] [endPage]\n", stderr)
    exit(1)
}

let inputURL = URL(fileURLWithPath: arguments[1])
let outputURL = URL(fileURLWithPath: arguments[2])
let startPage = max((arguments.count > 3 ? Int(arguments[3]) : nil) ?? 1, 1)
let endPageArgument = arguments.count > 4 ? Int(arguments[4]) : nil

guard let document = PDFDocument(url: inputURL) else {
    fputs("Unable to open PDF: \(inputURL.path)\n", stderr)
    exit(1)
}

let pageCount = document.pageCount
let endPage = min(endPageArgument ?? pageCount, pageCount)
let scale: CGFloat = 3.0
var output = ""

func renderedImage(for page: PDFPage) -> CGImage? {
    let bounds = page.bounds(for: .mediaBox)
    let image = NSImage(size: NSSize(width: bounds.width * scale, height: bounds.height * scale))
    image.lockFocus()
    guard let context = NSGraphicsContext.current?.cgContext else {
        image.unlockFocus()
        return nil
    }

    NSColor.white.setFill()
    NSRect(origin: .zero, size: image.size).fill()
    context.saveGState()
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    context.restoreGState()
    image.unlockFocus()

    return image.cgImage(forProposedRect: nil, context: nil, hints: nil)
}

for pageNumber in startPage...endPage {
    autoreleasepool {
        guard let page = document.page(at: pageNumber - 1), let image = renderedImage(for: page) else {
            output += "\n--- PAGE \(pageNumber) ---\n[OCR failed to render page]\n"
            return
        }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["ar-SA", "en-US"]

        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        do {
            try handler.perform([request])
            let observations = request.results ?? []
            let lines = observations.compactMap { observation in
                observation.topCandidates(1).first?.string
            }
            output += "\n--- PAGE \(pageNumber) ---\n"
            output += lines.joined(separator: "\n")
            output += "\n"
            print("OCR page \(pageNumber)/\(pageCount): \(lines.count) lines")
        } catch {
            output += "\n--- PAGE \(pageNumber) ---\n[OCR failed: \(error.localizedDescription)]\n"
            print("OCR page \(pageNumber)/\(pageCount) failed: \(error.localizedDescription)")
        }
    }
}

try output.write(to: outputURL, atomically: true, encoding: .utf8)
print("written OCR text to \(outputURL.path)")
