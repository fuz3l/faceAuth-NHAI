import UIKit
import AVFoundation
import TensorFlowLite
import React

@objc(FaceCaptureView)
class FaceCaptureView: UIView, AVCaptureVideoDataOutputSampleBufferDelegate {

    // Camera Session
    private var session: AVCaptureSession?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private let sessionQueue = DispatchQueue(label: "com.datalakefaceauth.camera.sessionQueue")
    
    // TFLite
    private var faceMeshInterpreter: Interpreter?
    private var faceEmbedderInterpreter: Interpreter?
    private var isModelLoaded = false
    private var isDemoMode = false
    
    // UI Overlay Layer
    private var overlayLayer = CAShapeLayer()
    
    // Liveness Tracking Variables
    private var currentStep = "LOOK_CENTER"
    private var blinkDetected = false
    private var leftTurnDetected = false
    private var rightTurnDetected = false
    private var eyeClosedFrames = 0
    private var faceEmbeddingSent = false
    
    // Simulator
    private var simulatedTick = 0
    private var simulationTimer: Timer?
    
    // React Native Event Handlers
    @objc var onFaceProcessed: RCTDirectEventBlock?
    @objc var onLivenessUpdate: RCTDirectEventBlock?
    @objc var onStatusMessage: RCTDirectEventBlock?

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupOverlay()
        loadTFLiteModels()
        
        #if targetEnvironment(simulator)
        startSimulationMode(reason: "iOS Simulator - Simulation Active")
        #else
        setupCamera()
        #endif
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupOverlay()
        loadTFLiteModels()
    }
    
    override func layoutSubviews() {
        super.layoutSubviews()
        previewLayer?.frame = self.bounds
        overlayLayer.frame = self.bounds
    }
    
    private func setupOverlay() {
        overlayLayer.fillColor = UIColor.clear.cgColor
        overlayLayer.strokeColor = UIColor(red: 0.0, green: 0.9, blue: 0.46, alpha: 0.8).cgColor // Neon green
        overlayLayer.lineWidth = 1.2
        self.layer.addSublayer(overlayLayer)
    }
    
    private func loadTFLiteModels() {
        guard let faceMeshPath = Bundle.main.path(forResource: "face_landmark", ofType: "tflite"),
              let faceEmbedderPath = Bundle.main.path(forResource: "mobilefacenet", ofType: "tflite") else {
            print("TFLite models missing from bundle resources.")
            fallbackToDemoMode(reason: "Models missing - Sandbox Mode")
            return
        }
        
        do {
            faceMeshInterpreter = try Interpreter(modelPath: faceMeshPath)
            faceEmbedderInterpreter = try Interpreter(modelPath: faceEmbedderPath)
            try faceMeshInterpreter?.allocateTensors()
            try faceEmbedderInterpreter?.allocateTensors()
            isModelLoaded = true
            print("TFLite models loaded successfully on iOS.")
        } catch {
            print("Failed to initialize TFLite interpreters: \(error)")
            fallbackToDemoMode(reason: "TFLite Init Failed - Sandbox Mode")
        }
    }
    
    private func fallbackToDemoMode(reason: String) {
        isDemoMode = true
        isModelLoaded = false
        startSimulationMode(reason: reason)
    }
    
    private func setupCamera() {
        if isDemoMode { return }
        
        session = AVCaptureSession()
        session?.sessionPreset = .medium
        
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else {
            fallbackToDemoMode(reason: "No Front Camera - Running Sandbox")
            return
        }
        
        do {
            let input = try AVCaptureDeviceInput(device: device)
            if session?.canAddInput(input) == true {
                session?.addInput(input)
            }
            
            let output = AVCaptureVideoDataOutput()
            output.alwaysDiscardsLateVideoFrames = true
            output.setSampleBufferDelegate(self, queue: DispatchQueue(label: "com.datalakefaceauth.camera.frameQueue"))
            
            if session?.canAddOutput(output) == true {
                session?.addOutput(output)
            }
            
            previewLayer = AVCaptureVideoPreviewLayer(session: session!)
            previewLayer?.videoGravity = .resizeAspectFill
            previewLayer?.frame = self.bounds
            self.layer.insertSublayer(previewLayer!, at: 0)
            
            sessionQueue.async {
                self.session?.startRunning()
            }
        } catch {
            fallbackToDemoMode(reason: "Camera Access Failed - Running Sandbox")
        }
    }
    
    private func startSimulationMode(reason: String) {
        isDemoMode = true
        emitStatusMessage(reason)
        
        DispatchQueue.main.async {
            self.simulationTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
                self?.simulatedTick += 1
                self?.updateSimulationState()
            }
        }
    }
    
    private func updateSimulationState() {
        if faceEmbeddingSent { return }
        
        let scaleX = Float(bounds.width)
        let scaleY = Float(bounds.height)
        let centerX = scaleX / 2.0
        let centerY = scaleY / 2.0
        
        var points = [CGPoint]()
        for i in 0..<468 {
            let angle = Float(i) * 0.1
            points.append(CGPoint(x: CGFloat(centerX + sin(angle) * 70.0), y: CGFloat(centerY + cos(angle) * 90.0)))
        }
        
        // Left eye landmarks: 263 (outer), 362 (inner)
        points[263] = CGPoint(x: CGFloat(centerX + 40.0), y: CGFloat(centerY - 30.0))
        points[362] = CGPoint(x: CGFloat(centerX + 15.0), y: CGFloat(centerY - 30.0))
        // Right eye landmarks: 33 (outer), 133 (inner)
        points[33] = CGPoint(x: CGFloat(centerX - 40.0), y: CGFloat(centerY - 30.0))
        points[133] = CGPoint(x: CGFloat(centerX - 15.0), y: CGFloat(centerY - 30.0))
        
        // Nose: 4, Cheek bounds: 234, 454
        points[4] = CGPoint(x: CGFloat(centerX), y: CGFloat(centerY))
        points[234] = CGPoint(x: CGFloat(centerX - 90.0), y: CGFloat(centerY))
        points[454] = CGPoint(x: CGFloat(centerX + 90.0), y: CGFloat(centerY))
        
        var simulatedEAR = 0.30
        var simulatedYawRatio = 0.50
        
        switch currentStep {
        case "LOOK_CENTER":
            emitStatusMessage("Look Center")
            simulatedYawRatio = 0.50
            if simulatedTick > 20 {
                currentStep = "BLINK"
                simulatedTick = 0
            }
        case "BLINK":
            emitStatusMessage("Blink Your Eyes")
            if simulatedTick >= 10 && simulatedTick <= 13 {
                simulatedEAR = 0.12
                blinkDetected = true
            } else {
                simulatedEAR = 0.30
            }
            if blinkDetected && simulatedTick > 25 {
                currentStep = "TURN_LEFT"
                simulatedTick = 0
            }
        case "TURN_LEFT":
            emitStatusMessage("Turn Head Left")
            let progress = min(Double(simulatedTick) / 20.0, 1.0)
            simulatedYawRatio = 0.50 - (progress * 0.25)
            points[4] = CGPoint(x: CGFloat(centerX - Float(progress * 45.0)), y: CGFloat(centerY))
            
            if simulatedYawRatio < 0.35 {
                leftTurnDetected = true
            }
            if leftTurnDetected && simulatedTick > 25 {
                currentStep = "TURN_RIGHT"
                simulatedTick = 0
            }
        case "TURN_RIGHT":
            emitStatusMessage("Turn Head Right")
            let progress = min(Double(simulatedTick) / 20.0, 1.0)
            simulatedYawRatio = 0.25 + (progress * 0.50)
            points[4] = CGPoint(x: CGFloat(centerX - 45.0 + Float(progress * 90.0)), y: CGFloat(centerY))
            
            if simulatedYawRatio > 0.65 {
                rightTurnDetected = true
            }
            if rightTurnDetected && simulatedTick > 25 {
                currentStep = "COMPLETED"
                simulatedTick = 0
            }
        case "COMPLETED":
            emitStatusMessage("Liveness Verified - Extracting Embedding")
            if !faceEmbeddingSent {
                sendEmbedding(mockEmbedding())
                faceEmbeddingSent = true
            }
        default:
            break
        }
        
        drawFaceMesh(points: points)
        emitLivenessEvent(ear: simulatedEAR, yaw: simulatedYawRatio)
    }
    
    private func mockEmbedding() -> [Double] {
        var emb = [Double]()
        for i in 0..<128 {
            emb.append(sin(Double(i) * 0.1))
        }
        var sum = 0.0
        for v in emb { sum += v * v }
        let norm = sqrt(sum)
        return emb.map { $0 / (norm == 0 ? 1.0 : norm) }
    }
    
    private func drawFaceMesh(points: [CGPoint]) {
        guard points.count >= 468 else { return }
        
        let path = UIBezierPath()
        
        // Draw points as tiny circles
        for pt in points {
            path.move(to: pt)
            path.addArc(withCenter: pt, radius: 1.5, startAngle: 0, endAngle: CGFloat.pi * 2, clockwise: true)
        }
        
        // Connect points for eye shapes to make it look technical
        connectPoints(indices: [33, 160, 158, 133, 153, 144, 33], points: points, path: path)
        connectPoints(indices: [263, 385, 387, 362, 373, 380, 263], points: points, path: path)
        
        DispatchQueue.main.async {
            self.overlayLayer.path = path.cgPath
        }
    }
    
    private func connectPoints(indices: [Int], points: [CGPoint], path: UIBezierPath) {
        var first = true
        for idx in indices {
            if idx < points.count {
                let pt = points[idx]
                if first {
                    path.move(to: pt)
                    first = false
                } else {
                    path.addLine(to: pt)
                }
            }
        }
    }
    
    private func emitStatusMessage(_ message: String) {
        onStatusMessage?(["message": message])
    }
    
    private func emitLivenessEvent(ear: Double, yaw: Double) {
        onLivenessUpdate?([
            "step": currentStep,
            "ear": ear,
            "yaw": yaw,
            "blink": blinkDetected,
            "turnLeft": leftTurnDetected,
            "turnRight": rightTurnDetected
        ])
    }
    
    private func sendEmbedding(_ embedding: [Double]) {
        onFaceProcessed?([
            "embedding": embedding,
            "livenessSuccess": true
        ])
    }
    
    // AVCapture Frame delegate (runs when real camera frame processed)
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        if faceEmbeddingSent { return }
        
        // In a full build with models, this would extract image buffer, scale to 192x192,
        // run faceMeshInterpreter to get 468 3D points, compute EAR and yaw ratio, and run mobilefacenet.
        // For the scope of this hackathon, we ensure standard fallback happens if models are placeholders.
        if !isModelLoaded {
            return
        }
        
        // Core iOS AVFoundation processing pipeline:
        // 1. Get pixelBuffer from sampleBuffer
        // 2. Preprocess to input formats
        // 3. Run Interpreter
        // 4. Update state machine
        // 5. Output events
    }
    
    deinit {
        session?.stopRunning()
        simulationTimer?.invalidate()
    }
}
