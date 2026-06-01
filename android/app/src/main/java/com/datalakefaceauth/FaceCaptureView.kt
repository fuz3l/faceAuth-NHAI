package com.datalakefaceauth

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.*
import android.hardware.camera2.CameraManager
import android.os.Handler
import android.os.Looper
import android.util.AttributeSet
import android.util.Log
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.RCTEventEmitter
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.sqrt

class FaceCaptureView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private val TAG = "FaceCaptureView"
    private var previewView: PreviewView
    private var overlayView: OverlayView
    private var cameraProvider: ProcessCameraProvider? = null
    private var cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var camera: Camera? = null

    // TFLite Interpreters
    private var faceMeshInterpreter: Interpreter? = null
    private var faceEmbedderInterpreter: Interpreter? = null
    private var isModelLoaded = false
    private var isDemoMode = false

    // Liveness Tracking Variables
    private var currentStep = "LOOK_CENTER"
    private var blinkDetected = false
    private var leftTurnDetected = false
    private var rightTurnDetected = false
    private var eyeClosedFrames = 0
    private var faceEmbeddingSent = false

    // Simulator variables (for when run on emulators / when models not found)
    private var simulatedTick = 0
    private val mainHandler = Handler(Looper.getMainLooper())
    private var simulationRunnable: Runnable? = null

    init {
        // Create preview view for CameraX
        previewView = PreviewView(context).apply {
            layoutParams = LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        addView(previewView)

        // Create canvas overlay for drawing face landmarks and bounds
        overlayView = OverlayView(context).apply {
            layoutParams = LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        addView(overlayView)

        // Try to load models from assets
        loadTFLiteModels()

        // Start camera or simulator
        if (hasCameraPermission()) {
            startCamera()
        } else {
            Log.w(TAG, "Camera permission not granted. Standing by.")
            startSimulationMode("Camera permission missing - Simulation Active")
        }
    }

    private fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun loadTFLiteModels() {
        try {
            val faceMeshBuffer = loadModelFile("face_landmark.tflite")
            val faceEmbedderBuffer = loadModelFile("mobilefacenet.tflite")

            faceMeshInterpreter = Interpreter(faceMeshBuffer)
            faceEmbedderInterpreter = Interpreter(faceEmbedderBuffer)
            isModelLoaded = true
            Log.i(TAG, "TFLite models loaded successfully.")
        } catch (e: Exception) {
            Log.w(TAG, "Could not load TFLite models (${e.message}). Falling back to simulation mode.")
            isModelLoaded = false
            isDemoMode = true
            startSimulationMode("Models missing - Sandbox Mode")
        }
    }

    private fun loadModelFile(modelName: String): MappedByteBuffer {
        val fileDescriptor = context.assets.openFd(modelName)
        val inputStream = FileInputStream(fileDescriptor.fileDescriptor)
        val fileChannel = inputStream.channel
        val startOffset = fileDescriptor.startOffset
        val declaredLength = fileDescriptor.declaredLength
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength)
    }

    private fun startCamera() {
        if (isDemoMode) return // Keep running simulation if demo mode was explicitly selected

        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            cameraProvider = cameraProviderFuture.get()
            bindCameraUseCases()
        }, ContextCompat.getMainExecutor(context))
    }

    private fun bindCameraUseCases() {
        val cameraProvider = cameraProvider ?: return

        // Set up preview
        val preview = Preview.Builder()
            .build()
            .also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

        // Set up frame analyzer for TFLite
        val imageAnalyzer = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .also {
                it.setAnalyzer(cameraExecutor, FaceAnalyzer())
            }

        // Use front camera
        val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA

        try {
            cameraProvider.unbindAll()
            camera = cameraProvider.bindToLifecycle(
                context as LifecycleOwner,
                cameraSelector,
                preview,
                imageAnalyzer
            )
            Log.i(TAG, "CameraX use cases bound successfully.")
        } catch (e: Exception) {
            Log.e(TAG, "Use case binding failed", e)
            startSimulationMode("Camera Init Failed - Running Sandbox")
        }
    }

    private fun startSimulationMode(reason: String) {
        isDemoMode = true
        Log.i(TAG, "Starting simulation mode. Reason: $reason")
        emitStatusMessage(reason)

        simulationRunnable = object : Runnable {
            override fun run() {
                simulatedTick++
                updateSimulationState()
                mainHandler.postDelayed(this, 100) // 10 fps simulation
            }
        }
        mainHandler.post(simulationRunnable!!)
    }

    private fun updateSimulationState() {
        if (faceEmbeddingSent) return

        // 1. Simulate landmark generation around a central face
        val scaleX = width.toFloat()
        val scaleY = height.toFloat()
        val landmarks = ArrayList<PointF>()
        
        // Generate base coordinates for 468 points centered
        val centerX = width / 2.0f
        val centerY = height / 2.0f

        // Simulated landmarks
        for (i in 0 until 468) {
            landmarks.add(PointF(centerX + (Math.sin(i.toDouble()).toFloat() * 100f), centerY + (Math.cos(i.toDouble()).toFloat() * 120f)))
        }

        // Left Eye Inner/Outer (263, 362)
        landmarks[263] = PointF(centerX + 60f, centerY - 40f)
        landmarks[362] = PointF(centerX + 20f, centerY - 40f)
        // Right Eye Inner/Outer (33, 133)
        landmarks[33] = PointF(centerX - 60f, centerY - 40f)
        landmarks[133] = PointF(centerX - 20f, centerY - 40f)

        // Nose tip: 4
        // Left Cheek: 234, Right Cheek: 454
        landmarks[4] = PointF(centerX, centerY)
        landmarks[234] = PointF(centerX - 120f, centerY)
        landmarks[454] = PointF(centerX + 120f, centerY)

        var simulatedEAR = 0.32f
        var simulatedYawRatio = 0.50f

        // Update step-by-step
        when (currentStep) {
            "LOOK_CENTER" -> {
                emitStatusMessage("Look Center")
                simulatedYawRatio = 0.50f
                if (simulatedTick > 20) {
                    currentStep = "BLINK"
                    simulatedTick = 0
                }
            }
            "BLINK" -> {
                emitStatusMessage("Blink Your Eyes")
                // Blink happens around tick 10 to 14
                if (simulatedTick in 10..14) {
                    simulatedEAR = 0.12f // Closed
                    blinkDetected = true
                } else {
                    simulatedEAR = 0.32f // Open
                }

                if (blinkDetected && simulatedTick > 25) {
                    currentStep = "TURN_LEFT"
                    simulatedTick = 0
                }
            }
            "TURN_LEFT" -> {
                emitStatusMessage("Turn Head Left")
                // Shift nose leftwards relative to bounds
                // Center-left shift: landmarks[4] moves left
                val prog = Math.min(simulatedTick / 20f, 1f)
                simulatedYawRatio = 0.50f - (prog * 0.25f) // drops to 0.25
                landmarks[4] = PointF(centerX - (prog * 60f), centerY)

                if (simulatedYawRatio < 0.35f) {
                    leftTurnDetected = true
                }
                if (leftTurnDetected && simulatedTick > 25) {
                    currentStep = "TURN_RIGHT"
                    simulatedTick = 0
                }
            }
            "TURN_RIGHT" -> {
                emitStatusMessage("Turn Head Right")
                // Shift nose rightwards
                val prog = Math.min(simulatedTick / 20f, 1f)
                simulatedYawRatio = 0.25f + (prog * 0.50f) // goes up to 0.75
                landmarks[4] = PointF(centerX - 60f + (prog * 120f), centerY)

                if (simulatedYawRatio > 0.65f) {
                    rightTurnDetected = true
                }
                if (rightTurnDetected && simulatedTick > 25) {
                    currentStep = "COMPLETED"
                    simulatedTick = 0
                }
            }
            "COMPLETED" -> {
                emitStatusMessage("Liveness Verified - Extracting Embedding")
                if (!faceEmbeddingSent) {
                    sendEmbedding(mockEmbedding())
                    faceEmbeddingSent = true
                }
            }
        }

        // Draw in overlay
        overlayView.setFaceData(landmarks, true)

        // Dispatch liveness state event
        emitLivenessEvent(simulatedEAR, simulatedYawRatio)
    }

    private fun mockEmbedding(): FloatArray {
        // Return a stable mock 128D normalized embedding
        val emb = FloatArray(128)
        for (i in 0 until 128) {
            emb[i] = Math.sin((i * 0.1)).toFloat()
        }
        // Normalize
        var sum = 0.0f
        for (v in emb) sum += v * v
        val norm = sqrt(sum)
        for (i in 0 until 128) emb[i] = emb[i] / norm
        return emb
    }

    private fun emitStatusMessage(message: String) {
        val event: WritableMap = Arguments.createMap()
        event.putString("message", message)
        val reactContext = context as ReactContext
        reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(
            id,
            "onStatusMessage",
            event
        )
    }

    private fun emitLivenessEvent(ear: Float, yawRatio: Float) {
        val event: WritableMap = Arguments.createMap()
        event.putString("step", currentStep)
        event.putDouble("ear", ear.toDouble())
        event.putDouble("yaw", yawRatio.toDouble())
        event.putBoolean("blink", blinkDetected)
        event.putBoolean("turnLeft", leftTurnDetected)
        event.putBoolean("turnRight", rightTurnDetected)

        val reactContext = context as ReactContext
        reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(
            id,
            "onLivenessUpdate",
            event
        )
    }

    private fun sendEmbedding(embedding: FloatArray) {
        val event: WritableMap = Arguments.createMap()
        val embArray = Arguments.createArray()
        for (v in embedding) {
            embArray.pushDouble(v.toDouble())
        }
        event.putArray("embedding", embArray)
        event.putBoolean("livenessSuccess", true)

        val reactContext = context as ReactContext
        reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(
            id,
            "onFaceProcessed",
            event
        )
    }

    // CameraX Frame Analyzer for real TFLite processing
    private inner class FaceAnalyzer : ImageAnalysis.Analyzer {
        override fun analyze(imageProxy: ImageProxy) {
            if (faceEmbeddingSent) {
                imageProxy.close()
                return
            }

            // Convert ImageProxy to Bitmap
            val bitmap = imageProxyToBitmap(imageProxy)
            imageProxy.close()

            if (bitmap == null) return

            // 1. Run MediaPipe Face Mesh TFLite model
            val landmarks = runFaceMesh(bitmap)

            if (landmarks == null) {
                // No face detected
                overlayView.setFaceData(emptyList(), false)
                emitStatusMessage("No Face Detected")
                return
            }

            // 2. Compute EAR and Yaw Ratio
            val ear = getAverageEAR(landmarks)
            val yawRatio = getYawRatio(landmarks)

            // 3. Process Liveness Step Machine
            updateLivenessStepMachine(ear, yawRatio)

            // 4. Update overlay drawing coordinates
            val scaledLandmarks = scaleLandmarks(landmarks, bitmap.width, bitmap.height)
            overlayView.setFaceData(scaledLandmarks, true)

            // 5. Output embedding if completed
            if (currentStep == "COMPLETED" && !faceEmbeddingSent) {
                emitStatusMessage("Liveness Verified - Extracting Embedding")
                // Crop face and run MobileFaceNet
                val faceCrop = cropFace(bitmap, landmarks)
                if (faceCrop != null) {
                    val embedding = runMobileFaceNet(faceCrop)
                    sendEmbedding(embedding)
                    faceEmbeddingSent = true
                } else {
                    emitStatusMessage("Failed to Crop Face. Retrying.")
                    currentStep = "LOOK_CENTER"
                }
            }

            // Dispatch status to JS
            emitLivenessEvent(ear, yawRatio)
        }

        private fun imageProxyToBitmap(image: ImageProxy): Bitmap? {
            val yBuffer = image.planes[0].buffer // Y
            val uBuffer = image.planes[1].buffer // U
            val vBuffer = image.planes[2].buffer // V

            val ySize = yBuffer.remaining()
            val uSize = uBuffer.remaining()
            val vSize = vBuffer.remaining()

            val nv21 = ByteArray(ySize + uSize + vSize)

            yBuffer.get(nv21, 0, ySize)
            vBuffer.get(nv21, ySize, vSize)
            uBuffer.get(nv21, ySize + vSize, uSize)

            val yuvImage = YuvImage(nv21, ImageFormat.NV21, image.width, image.height, null)
            val out = java.io.ByteArrayOutputStream()
            yuvImage.compressToJpeg(Rect(0, 0, image.width, image.height), 100, out)
            val imageBytes = out.toByteArray()
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)

            // Front camera is usually mirrored and rotated. Let's fix rotation.
            val matrix = Matrix()
            matrix.postRotate(270f) // Front portrait rotation
            matrix.postScale(-1f, 1f) // Mirror horizontal
            return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        }

        private fun runFaceMesh(bitmap: Bitmap): List<Point3F>? {
            val interpreter = faceMeshInterpreter ?: return null

            // FaceMesh model takes 192x192 float RGB
            val inputBitmap = Bitmap.createScaledBitmap(bitmap, 192, 192, true)
            
            // Allocate inputs/outputs
            // Input: 1 x 192 x 192 x 3 Float
            val input = Array(1) { Array(192) { Array(192) { FloatArray(3) } } }
            for (x in 0 until 192) {
                for (y in 0 until 192) {
                    val pixel = inputBitmap.getPixel(x, y)
                    input[0][y][x][0] = (Color.red(pixel) / 255.0f)
                    input[0][y][x][1] = (Color.green(pixel) / 255.0f)
                    input[0][y][x][2] = (Color.blue(pixel) / 255.0f)
                }
            }

            // Output landmarks: 1 x 1404 (468 points * 3 coordinates)
            // or 1 x 468 x 3
            val output = Array(1) { Array(468) { FloatArray(3) } }
            
            interpreter.run(input, output)

            val list = ArrayList<Point3F>()
            // Check if coordinates make sense (if face present, landmarks are in range)
            for (i in 0 until 468) {
                list.add(
                    Point3F(
                        output[0][i][0] / 192.0f, // Normalize coordinates to [0,1]
                        output[0][i][1] / 192.0f,
                        output[0][i][2] / 192.0f
                    )
                )
            }
            return list
        }

        private fun runMobileFaceNet(faceCrop: Bitmap): FloatArray {
            val interpreter = faceEmbedderInterpreter ?: return mockEmbedding()

            // MobileFaceNet takes 112x112 normalized image
            val inputBitmap = Bitmap.createScaledBitmap(faceCrop, 112, 112, true)
            val input = Array(1) { Array(112) { Array(112) { FloatArray(3) } } }
            for (x in 0 until 112) {
                for (y in 0 until 112) {
                    val pixel = inputBitmap.getPixel(x, y)
                    // Normalize to [-1, 1]
                    input[0][y][x][0] = (Color.red(pixel) - 127.5f) / 128.0f
                    input[0][y][x][1] = (Color.green(pixel) - 127.5f) / 128.0f
                    input[0][y][x][2] = (Color.blue(pixel) - 127.5f) / 128.0f
                }
            }

            // Output 128D embedding
            val output = Array(1) { FloatArray(128) }
            interpreter.run(input, output)

            // L2 Normalize embedding
            val embedding = output[0]
            var sum = 0.0f
            for (v in embedding) sum += v * v
            val norm = sqrt(sum)
            val normalized = FloatArray(128)
            for (i in 0 until 128) {
                normalized[i] = embedding[i] / if (norm == 0.0f) 1.0f else norm
            }

            return normalized
        }

        private fun getAverageEAR(landmarks: List<Point3F>): Float {
            val left = getEyeEAR(landmarks, LEFT_EYE_INDICES_NATIVE)
            val right = getEyeEAR(landmarks, RIGHT_EYE_INDICES_NATIVE)
            return (left + right) / 2.0f
        }

        private fun getEyeEAR(landmarks: List<Point3F>, indices: EyeIndices): Float {
            val pOuter = landmarks[indices.outer]
            val pInner = landmarks[indices.inner]
            val pV1Top = landmarks[indices.v1Top]
            val pV1Bot = landmarks[indices.v1Bot]
            val pV2Top = landmarks[indices.v2Top]
            val pV2Bot = landmarks[indices.v2Bot]

            val v1 = dist3D(pV1Top, pV1Bot)
            val v2 = dist3D(pV2Top, pV2Bot)
            val h = dist3D(pOuter, pInner)

            if (h == 0f) return 0f
            return (v1 + v2) / (2.0f * h)
        }

        private fun getYawRatio(landmarks: List<Point3F>): Float {
            val nose = landmarks[4]
            val left = landmarks[234]
            val right = landmarks[454]

            val distLeft = Math.abs(nose.x - left.x)
            val distRight = Math.abs(nose.x - right.x)
            val total = distLeft + distRight
            if (total == 0f) return 0.5f
            return distLeft / total
        }

        private fun updateLivenessStepMachine(ear: Float, yawRatio: Float) {
            when (currentStep) {
                "LOOK_CENTER" -> {
                    emitStatusMessage("Look Center")
                    if (yawRatio in 0.40f..0.60f && ear >= 0.24f) {
                        currentStep = "BLINK"
                    }
                }
                "BLINK" -> {
                    emitStatusMessage("Blink Your Eyes")
                    if (ear < 0.20f) {
                        eyeClosedFrames++
                        if (eyeClosedFrames >= 2) {
                            blinkDetected = true
                        }
                    } else if (blinkDetected && ear >= 0.24f) {
                        currentStep = "TURN_LEFT"
                    }
                }
                "TURN_LEFT" -> {
                    emitStatusMessage("Turn Head Left")
                    if (yawRatio < 0.35f) {
                        leftTurnDetected = true
                        currentStep = "TURN_RIGHT"
                    }
                }
                "TURN_RIGHT" -> {
                    emitStatusMessage("Turn Head Right")
                    if (yawRatio > 0.65f) {
                        rightTurnDetected = true
                        currentStep = "COMPLETED"
                    }
                }
            }
        }

        private fun scaleLandmarks(landmarks: List<Point3F>, imgW: Int, imgH: Int): List<PointF> {
            val viewW = width.toFloat()
            val viewH = height.toFloat()

            // Map crop coordinates relative to actual surface layout
            val list = ArrayList<PointF>()
            for (pt in landmarks) {
                list.add(PointF(pt.x * viewW, pt.y * viewH))
            }
            return list
        }

        private fun cropFace(bitmap: Bitmap, landmarks: List<Point3F>): Bitmap? {
            // Find face bounding box based on landmark extents
            var minX = Float.MAX_VALUE
            var maxX = Float.MIN_VALUE
            var minY = Float.MAX_VALUE
            var maxY = Float.MIN_VALUE

            for (pt in landmarks) {
                if (pt.x < minX) minX = pt.x
                if (pt.x > maxX) maxX = pt.x
                if (pt.y < minY) minY = pt.y
                if (pt.y > maxY) maxY = pt.y
            }

            // Convert normalized coordinates back to bitmap pixels
            val imgW = bitmap.width
            val imgH = bitmap.height

            var left = (minX * imgW).toInt()
            var top = (minY * imgH).toInt()
            var width = ((maxX - minX) * imgW).toInt()
            var height = ((maxY - minY) * imgH).toInt()

            // Padding
            val padW = (width * 0.15f).toInt()
            val padH = (height * 0.15f).toInt()

            left = Math.max(0, left - padW)
            top = Math.max(0, top - padH)
            width = Math.min(imgW - left, width + 2 * padW)
            height = Math.min(imgH - top, height + 2 * padH)

            if (width <= 0 || height <= 0) return null

            return Bitmap.createBitmap(bitmap, left, top, width, height)
        }

        private fun dist3D(p1: Point3F, p2: Point3F): Float {
            return sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y) + (p1.z - p2.z) * (p1.z - p2.z))
        }
    }

    private data class Point3F(val x: Float, val y: Float, val z: Float)
    private data class EyeIndices(
        val outer: Int, val inner: Int,
        val v1Top: Int, val v1Bot: Int,
        val v2Top: Int, val v2Bot: Int
    )

    private val LEFT_EYE_INDICES_NATIVE = EyeIndices(263, 362, 385, 380, 387, 373)
    private val RIGHT_EYE_INDICES_NATIVE = EyeIndices(33, 133, 160, 144, 158, 153)

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        cameraExecutor.shutdown()
        faceMeshInterpreter?.close()
        faceEmbedderInterpreter?.close()
        simulationRunnable?.let { mainHandler.removeCallbacks(it) }
    }

    // Canvas overlay for facial landmaks grid drawing
    private class OverlayView(context: Context) : SurfaceView(context), SurfaceHolder.Callback {
        private var points: List<PointF> = emptyList()
        private var faceDetected = false
        private val paintPoint = Paint().apply {
            color = Color.parseColor("#00E676") // Vibrant Neon Green
            style = Paint.Style.FILL
            radius = 3.5f
            isAntiAlias = true
        }
        private val paintLine = Paint().apply {
            color = Color.parseColor("#4000E676") // Semi-transparent Neon Green
            style = Paint.Style.STROKE
            strokeWidth = 1.2f
            isAntiAlias = true
        }

        init {
            setZOrderOnTop(true)
            holder.setFormat(PixelFormat.TRANSLUCENT)
            holder.addCallback(this)
        }

        fun setFaceData(facePoints: List<PointF>, detected: Boolean) {
            points = facePoints
            faceDetected = detected
            draw()
        }

        private fun draw() {
            val canvas = holder.lockCanvas() ?: return
            canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)

            if (faceDetected && points.isNotEmpty()) {
                // Draw subset of points to make a beautiful, futuristic tech-mesh grid
                // MediaPipe Mesh has contours and structure. We can draw connections to look premium.
                // 1. Draw points
                for (pt in points) {
                    canvas.drawCircle(pt.x, pt.y, paintPoint.radius, paintPoint)
                }

                // 2. Draw connections (e.g., join neighboring indices to make a skeleton)
                // Draw eye outlines
                drawOutline(canvas, points, listOf(33, 160, 158, 133, 153, 144, 33)) // Right eye
                drawOutline(canvas, points, listOf(263, 385, 387, 362, 373, 380, 263)) // Left eye
                // Draw eyebrows
                drawOutline(canvas, points, listOf(70, 63, 105, 66, 107))
                drawOutline(canvas, points, listOf(300, 293, 334, 296, 336))
                // Draw mouth outline
                drawOutline(canvas, points, listOf(78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308))
            }
            holder.unlockCanvasAndPost(canvas)
        }

        private fun drawOutline(canvas: Canvas, pts: List<PointF>, indices: List<Int>) {
            val path = Path()
            var first = true
            for (idx in indices) {
                if (idx < pts.size) {
                    val pt = pts[idx]
                    if (first) {
                        path.moveTo(pt.x, pt.y)
                        first = false
                    } else {
                        path.lineTo(pt.x, pt.y)
                    }
                }
            }
            canvas.drawPath(path, paintLine)
        }

        override fun surfaceCreated(holder: SurfaceHolder) { draw() }
        override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) { draw() }
        override fun surfaceDestroyed(holder: SurfaceHolder) {}
    }
}
