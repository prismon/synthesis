// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "SynthesisApp",
  platforms: [.macOS(.v14)],
  products: [
    .executable(name: "SynthesisApp", targets: ["SynthesisApp"])
  ],
  dependencies: [],
  targets: [
    .executableTarget(
      name: "SynthesisApp",
      dependencies: [],
      path: "Sources/SynthesisApp"
    )
  ]
)
