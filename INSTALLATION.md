# KivoAI — Windows installer and first-run guide

KivoAI is a locally hosted developer assistant. **No paid API key or account is required.** The installer is a readable Windows batch script that checks for dependencies and uses Windows Package Manager (`winget`) to install missing programs **only after asking**.

## Quick start

1. Download the complete KivoAI Windows ZIP or the repository source ZIP and **extract it**, not just `installer.bat`.
2. Open the extracted `Kivo-Windows` folder (the one containing `kivo.cmd` and `installer.bat`).
3. Double-click **`installer.bat`**. Use a regular Windows user account; do not run it as administrator unless a trusted package installer specifically requests permission.
4. Follow the prompts to install **Node.js 22+** and **Ollama**. The installer uses the `OpenJS.NodeJS.LTS` and `Ollama.Ollama` packages from the `winget` source.
5. Permit the **Kimi Q2 model** download if it's not already installed (approximately **6.6 GB**). Kivo's default chat mode expects Kimi; the installer selects the same known model as the supplied starter package.
6. Optionally download **Qwen2.5-Coder 7B** (approximately **4.7 GB**) for better code editing. If you choose to make it the coding model, that setting goes in Kivo's existing preferences folder without replacing any memories.
7. Optionally install Python and Pygame for Python code verification and running Pygame games.
8. Choose **Launch Kivo** when prompted, or start it any time with `kivo.cmd`.

The batch installer **does not** install global npm packages or run online PowerShell scripts. The current Kivo CLI is built with Node's standard library, so `npm install` is not required.

## Manual commands

If you prefer manual setup:

```cmd
winget install --id OpenJS.NodeJS.LTS --exact --source winget
winget install --id Ollama.Ollama --exact --source winget
ollama pull hf.co/mradermacher/Kimi-VL-A3B-Instruct-GGUF:Q2_K
ollama pull qwen2.5-coder:7b
kivo.cmd --model hf.co/mradermacher/Kimi-VL-A3B-Instruct-GGUF:Q2_K --speed balanced
```

The Qwen download is optional. Inside Kivo, activate it for coding with:

```text
/coding-model qwen2.5-coder:7b
/code add a test and fix the bug in my project
/verify
```

If you're starting Kivo from a folder that isn't your source project, open Kivo in that project with an explicit `--project` argument via the Node entry point, or follow Kivo's project-selection instructions. The default `kivo.cmd` uses `Documents\KivoProjects` (or legacy `Documents\ProjectMateProjects`).

## Troubleshooting

- **`winget` not recognised:** Install/update **App Installer** through Microsoft Store. Or install Node.js and Ollama from their official websites (`nodejs.org`, `ollama.com`).
- **`node` or `ollama` not recognised after installation:** Close Command Prompt, open a new one, and rerun `installer.bat`. Installing applications can change `PATH` only for newly opened processes.
- **Ollama not responding:** Open the Ollama app from the Start menu. Alternatively run `ollama serve` in a separate Command Prompt. Check `http://127.0.0.1:11434/api/tags` locally. Do not expose Ollama's server to the internet.
- **Model download fails:** Ensure internet connectivity and sufficient disk space. Retry with `ollama pull MODEL_NAME`. Partially downloaded model layers may be reused by Ollama.
- **Not enough VRAM:** Kivo can still run on CPU, but responses may be slow. The default Kimi Q2 model is smaller than the Q4 model. The optional Qwen Coder 3B model (`qwen2.5-coder:3b`) is smaller than 7B, but must be configured manually.
- **Python not detected:** Restart the terminal and run `py -3 --version` or `python --version`. Python is optional for Kivo chat.
- **Pygame fails to install:** `py -3 -m pip install --user pygame` or create a Python virtual environment for your game. You don't need Pygame to use Kivo itself.
- **Script stops after installing something:** This is often a PATH refresh issue. Run it again; it skips installed dependencies and detects existing models.

## Privacy and safe installation

The installer **never clears or overwrites** `%USERPROFILE%\.projectmate-kimi\` memories, project notes, sessions or other settings. It only writes `coding-model.txt` with your explicit permission if that file doesn't already exist. Kivo's `KIVO_HOME` and `PROJECTMATE_KIMI_HOME` overrides are respected.

Model downloads come from Ollama and the model author's repository; confirm the model's licence before redistribution. Model downloads use disk space and an internet connection, and Windows may ask for approval to install Node.js or Ollama. File changes made later by Kivo still require their own confirmations.

**Known limitation:** This batch installer was created and reviewed outside Windows; actual `winget` and Ollama installation must be tested on a Windows machine before claiming that clean-machine setup is fully verified.
