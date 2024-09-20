import React, { useState, useEffect, useRef, useMemo } from "react"
import RBMediaRecorder, {
  checkPermission,
  getConnectedDevices,
  requestPermission,
} from "rippleberry-camera-recorder"
import "./App.css"

const App: React.FC = () => {
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>("")
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("")
  const [permissionsGranted, setPermissionsGranted] = useState(false)

  const options = useMemo(() => {
    return {
      video: { deviceId: selectedVideoDevice, width: 1280, height: 720 },
      audio: { deviceId: selectedAudioDevice },
      mimeType: "video/webm",
      audioBitsPerSecond: 128000,
      videoBitsPerSecond: 2500000,
    }
  }, [selectedVideoDevice, selectedAudioDevice])

  const recorderRef = useRef<RBMediaRecorder | null>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    const loadDevices = async () => {
      const { videoDevices, audioDevices } = await getConnectedDevices()
      setVideoDevices(videoDevices)
      setAudioDevices(audioDevices)

      if (videoDevices.length > 0) {
        setSelectedVideoDevice(videoDevices[0].deviceId) // Default to first video device
      }
      if (audioDevices.length > 0) {
        setSelectedAudioDevice(audioDevices[0].deviceId) // Default to first audio device
      }
    }

    if (permissionsGranted) {
      loadDevices()
    } else {
      initiateAskPermissonProcess()
    }
  }, [permissionsGranted])

  const initiateAskPermissonProcess = async () => {
    checkPermission()
      .then((e) => {
        if (e.camera && e.microphone) setPermissionsGranted(true)
        else {
          requestPermission().then((e) => {
            if (e) setPermissionsGranted(e)
          })
        }
      })
      .catch((e) => {
        console.error(e)
        setPermissionsGranted(false)
      })
  }

  const startPreview = async () => {
    setVideoBlob(null) // Clear previous video

    const recorder = new RBMediaRecorder(options)

    recorderRef.current = recorder

    try {
      const stream = await recorder.getPreviewStream()
      setIsPreviewing(true)
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream
        videoElementRef.current.play()
      }
    } catch (err) {
      console.error("Error starting recorder:", err)
    }
  }

  const stopStream = () => {
    recorderRef.current?.reset()
    setIsPreviewing(false)
  }

  const startRecording = async () => {
    setIsPreviewing(false)
    setVideoBlob(null) // Clear previous video

    const recorder = new RBMediaRecorder(options)

    recorderRef.current = recorder

    try {
      const stream = await recorder.start()
      setIsRecording(true)
      setRecordingTime(0) // Reset timer
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream
        videoElementRef.current.play()
      }
      timerRef.current = setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1)
      }, 1000) // Timer increments every second
    } catch (err) {
      console.error("Error starting recorder:", err)
    }
  }

  const stopRecording = async () => {
    if (!recorderRef.current) return

    try {
      const blob = await recorderRef.current.stop()
      setVideoBlob(blob as Blob)
      setIsRecording(false)
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = null
      }
      if (timerRef.current) clearInterval(timerRef.current)
    } catch (err) {
      console.error("Error stopping recorder:", err)
    }
  }

  useEffect(() => {
    if (videoBlob && videoElementRef.current) {
      const videoURL = URL.createObjectURL(videoBlob)
      videoElementRef.current.src = videoURL
      videoElementRef.current.play()
    }
  }, [videoBlob])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  const handleVideoDeviceChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setSelectedVideoDevice(event.target.value)
    if (recorderRef.current) {
      recorderRef.current.changeVideoDevice(event.target.value)
    }
  }

  const handleAudioDeviceChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setSelectedAudioDevice(event.target.value)
    if (recorderRef.current) {
      recorderRef.current.changeAudioDevice(event.target.value)
    }
  }

  return (
    <div className="app">
      <h1 className="title">RippleBerry Camera Recorder Demo</h1>

      {!permissionsGranted ? (
        <div className="permission-request">
          <p>We need your permission to access the camera and microphone.</p>
          <button
            onClick={initiateAskPermissonProcess}
            className="grant-permission-btn"
          >
            Grant Permission
          </button>
        </div>
      ) : (
        <>
          {/* Device Selection */}
          <div className="device-selection">
            <div className="select-container">
              <label>Video Source:</label>
              <select
                onChange={handleVideoDeviceChange}
                value={selectedVideoDevice}
              >
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="select-container">
              <label>Audio Source:</label>
              <select
                onChange={handleAudioDeviceChange}
                value={selectedAudioDevice}
              >
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Video Display */}
          <div className="video-wrapper">
            <video
              ref={videoElementRef}
              className="video-element"
              controls={!isRecording && videoBlob !== null}
            />
            {isRecording && (
              <div className="recording-indicator">
                <span className="dot"></span>
                {formatTime(recordingTime)}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="controls">
            {!isRecording ? (
              <>
                <button
                  className="preview-btn"
                  onClick={isPreviewing ? stopStream : startPreview}
                >
                  {isPreviewing ? "Stop Preview" : "Start Preview"}
                </button>
                <button className="record-btn" onClick={startRecording}>
                  Start Recording
                </button>
              </>
            ) : (
              <button className="stop-btn" onClick={stopRecording}>
                Stop Recording
              </button>
            )}

            {videoBlob && (
              <a
                href={URL.createObjectURL(videoBlob)}
                download="recorded-video.webm"
                className="download-btn"
              >
                Download Video
              </a>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default App
