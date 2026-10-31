# Kivo v0.7.0 — New name and geometric avatar

Kivo is the renamed local developer AI previously called ProjectMate. Launch with `kivo.cmd` or `kivo.ps1` (Windows). Existing `projectmate.cmd` shortcuts remain supported. The underlying local Ollama model (including Kimi) is unchanged.

New terminal styling: violet/coral/gold **prism** palette (default), plus `/theme sunset`, `/theme garden`, `/theme mono`. Avatar shapes: `/avatar prism`, `/avatar orbit`, `/avatar bloom`. Changes are stored locally in `appearance.json`; no graphics packages or online assets required. The mascot is Unicode terminal art, not a new image model.

**Upgrade compatibility:** For existing installs, Kivo intentionally continues using `%USERPROFILE%\.projectmate-kimi\` for history, memory, settings and backups. This legacy storage path and the older `PROJECTMATE_KIMI_HOME` and `PROJECTMATE_OLLAMA_URL` environment variables are intentionally preserved. An optional `KIVO_HOME` override is supported. Existing `ProjectMateProjects` folders are detected before making a new `KivoProjects` folder. Do not delete your old data directory.

To install, extract this ZIP into Downloads and run `kivo.cmd --model <your-installed-ollama-model>`. This release includes the direct-memory fix from v0.6.2 and does not require a model re-download.

---

# Kivo v0.6.2 — adaptive tool planning and context

See **UPGRADE-v0.6.1.txt** for `/plan`, `/context` and the new bounded tool-planning mechanism.

# Kivo v0.6.0 — local coding agent and selective memory

Start with **UPGRADE-v0.6.0.txt**.

# Kivo Kimi — Windows CUDA Edition (v0.4.8)

**Real, locally hosted Moonshot Kimi model weights, no subscription or paid API required.**

## Requirements
- Windows 10/11, **Node.js 22 or newer** (Node.js 24 is fine)
- **Ollama for Windows**, running on `http://127.0.0.1:11434`
- An installed Kimi model. For an RTX 4060 Ti **8 GB**, the smaller quantisation is a more practical starting point than the 11 GB Q4 model. CUDA is automatic in the normal Ollama Windows installation.

## Installation

1. Install Ollama: https://ollama.com/download/windows
2. Install Node.js: https://nodejs.org/
3. In PowerShell, download the smaller *real Kimi model* (one-time download of about 6.7 GB):

   ```powershell
   ollama pull hf.co/mradermacher/Kimi-VL-A3B-Instruct-GGUF:Q2_K
   ```

4. Extract this ZIP; open PowerShell in the extracted **Kivo-Kimi-Windows** directory.
5. Run:

   ```powershell
   .\kivo.cmd
   ```

   or:

   ```powershell
   .\kivo.cmd --model hf.co/mradermacher/Kimi-VL-A3B-Instruct-GGUF:Q2_K
   ```

   `.\kivo.ps1` is also available, but PowerShell's execution policy may block scripts. The `.cmd` launcher avoids that.

## Benchmark CUDA

While a response is generating, open another PowerShell window:

```powershell
ollama ps
nvidia-smi
```

Ollama `PROCESSOR` shows GPU/CPU split. Inside Kivo use `/bench` to measure tokens/sec. If the model is partly on CPU, close GPU-heavy apps and consider using a smaller quantisation. An 8 GB GPU can't fully contain an 11 GB Kimi Q4 model.

## Kivo controls

- `/help`, `/files`, `/read file`, `/new file task`, `/edit file task`, `/undo`
- `/search query`, `/web https://example.com`, `/machine`, `/bench`
- `/shell Get-ChildItem` runs an approved **PowerShell** command in your current project, after you explicitly type `RUN`
- `/agent task` allows limited tool planning; it still asks before commands or writes
- `/speed turbo`, `/speed balanced`, `/speed quality`

The default project directory is `%USERPROFILE%\Documents\KivoProjects`. To use a different existing project:

```powershell
.\kivo.cmd --project "C:\Users\YourName\Documents\MyUnityProject"
```

## Security and scope

Kivo asks before file edits and shell actions. Never approve commands you don't understand. Public HTTPS browsing is permitted, but private-network browsing is blocked from `/web`; don't expose the Ollama API to the internet. The software runs as your current Windows account, not as an administrator. Local models may not reliably use all agent tools; these features remain experimental. This package includes only the lightweight Kivo terminal, **not** the full upstream Kimi Code engine.

## Troubleshooting

- `ollama list` should show a model before starting Kivo.
- If no local model found, provide `--model` with its exact name from `ollama list`.
- If CUDA is inactive, check `ollama ps` and `nvidia-smi`, and update Ollama if necessary.
- If the model is too slow, `/bench` distinguishes generation speed from loading time.
- To connect from another device, securely configure the network and access controls first; the default launcher deliberately uses only localhost.

## Learning & permissions (v0.4.8)

Use `/permissions trusted` to auto-run a small read-only shell allowlist; other commands still require RUN and file writes require APPLY. Use `/learn correction <text>`, `/learn success <text>`, `/learn list`, `/learn web <https-url>` and `/learn on|off`. Lessons are stored locally and injected only when relevant. Web content remains untrusted; this is memory, not weight training. See WINDOWS-README.md for details.


### Memory routing fix (v0.6.2)

Kivo handles direct memory requests without model planning, e.g. `can you update your memory that my name is Zak and i am a young developer` or `/memory remember my name is Zak`. It records explicitly requested identity facts even though automatic memory remains limited to technical preferences/project facts. Saved facts are stored under `.projectmate-kimi/memory.json`, shown with `/memory list`, and removable with `/memory forget ID`. Explicit facts are blocked when memory mode is off. Context resizing and tool approval rules are unchanged.
"# KivoAI" 
