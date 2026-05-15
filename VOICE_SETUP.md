# Piper TTS Setup

This project uses **Piper TTS** for a local, high-quality Jarvis voice.

## Prerequisites

1.  **Git LFS:** The Jarvis model is stored using Git LFS. 
    *   Install Git LFS from [git-lfs.github.com](https://git-lfs.github.com).
    *   Run `git lfs pull` in the project root to download the model files.

## Automated Setup (Windows)

Run the following command in PowerShell from the project root to download and set up the Piper engine:

```powershell
scripts/setup-voice.ps1
```

## Manual Setup

If you are not on Windows or the script fails:

1.  Download the Piper binary for your OS from the [Piper Releases](https://github.com/rhasspy/piper/releases).
2.  Extract the contents into `bin/piper/piper/`.
3.  Ensure the following structure exists:
    *   `bin/piper/jarvis-high.onnx` (Pulled via LFS)
    *   `bin/piper/jarvis-high.onnx.json` (Pulled via Git)
    *   `bin/piper/piper/piper.exe` (The engine)
