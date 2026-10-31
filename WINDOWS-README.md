# Kivo v0.7.0 — New name and geometric avatar

Kivo is the renamed local developer AI previously called ProjectMate. Launch with `kivo.cmd` or `kivo.ps1` (Windows). Existing `projectmate.cmd` shortcuts remain supported. The underlying local Ollama model (including Kimi) is unchanged.

New terminal styling: violet/coral/gold **prism** palette (default), plus `/theme sunset`, `/theme garden`, `/theme mono`. Avatar shapes: `/avatar prism`, `/avatar orbit`, `/avatar bloom`. Changes are stored locally in `appearance.json`; no graphics packages or online assets required. The mascot is Unicode terminal art, not a new image model.

**Upgrade compatibility:** For existing installs, Kivo intentionally continues using `%USERPROFILE%\.projectmate-kimi\` for history, memory, settings and backups. This legacy storage path and the older `PROJECTMATE_KIMI_HOME` and `PROJECTMATE_OLLAMA_URL` environment variables are intentionally preserved. An optional `KIVO_HOME` override is supported. Existing `ProjectMateProjects` folders are detected before making a new `KivoProjects` folder. Do not delete your old data directory.

To install, extract this ZIP into Downloads and run `kivo.cmd --model <your-installed-ollama-model>`. This release includes the direct-memory fix from v0.6.2 and does not require a model re-download.

---

# Kivo 0.6.2 — Adaptive Context and Tool Planning

See `UPGRADE-v0.6.1.txt`. Windows install is an in-place ZIP update. Existing models and memories are not replaced.

# Kivo 0.6.0 — new: `/code`, `/review`, `/verify`, `/coding-model`, `/memory`

See `UPGRADE-v0.6.0.txt` for usage, approval controls, security, and limitations.

# v0.4.6 Update — safe tool boundaries, search fallback, and chatbot identity

See `UPGRADE-v0.4.6.txt` for details. All external search results require verification; only explicit user tasks can authorize proposing edits or commands.

# v0.4.5 Update — Automatic YouTube search and reply-loop protection

See `UPGRADE-v0.4.5.txt`. Automatic online video research searches indexed public results and prints links; it does not watch videos. `/clear` removes previous chat history but leaves project notes intact.

# Kivo Kimi — Windows CUDA Edition (v0.4.4)

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

Kivo asks before file edits and all non-allowlisted shell actions; in optional trusted mode, narrowly allowlisted read-only commands run without a prompt. Never approve commands you don't understand. Public HTTPS browsing is permitted, but private-network browsing is blocked from `/web`; don't expose the Ollama API to the internet. The software runs as your current Windows account, not as an administrator. Local models may not reliably use all agent tools; these features remain experimental. This package includes only the lightweight Kivo terminal, **not** the full upstream Kimi Code engine.

## v0.4.4 fix — focused conversations

Earlier builds injected your entire saved maker-project profile into every message, even `hello`. With a small local model, this could lead to unrelated Raspberry Pi responses instead of natural chat. Now:

- Simple greetings receive a clean prompt and no stale chat history.
- Ordinary general questions no longer include unrelated project notes.
- Your technical background remains available when you ask about your projects, devices or previous work.
- Greetings use a smaller answer budget to reduce needless rambling.

To start a completely fresh chat, type `/clear` inside Kivo (this keeps project notes). You **do not** need to delete your saved profile or reinstall Ollama.

## v0.4.3 fix — paths with spaces

Fixes the launcher crash `'C:\Program' is not recognized` on standard Windows
Node.js installations in `C:\Program Files\nodejs`. Child Node processes are
now launched directly rather than through an unquoted Windows command shell.
No changes to Ollama models or Kivo history are required.

## Troubleshooting

- `ollama list` should show a model before starting Kivo.
- If no local model found, provide `--model` with its exact name from `ollama list`.
- If CUDA is inactive, check `ollama ps` and `nvidia-smi`, and update Ollama if necessary.
- If the model is too slow, `/bench` distinguishes generation speed from loading time.
- To connect from another device, securely configure the network and access controls first; the default launcher deliberately uses only localhost.

## Kivo Brain v0.4.7

The first run creates an editable behaviour guide at:
`%USERPROFILE%\.projectmate-kimi\brain.md`

Type `/brain` to see the guide. You can edit the Markdown file and restart Kivo to use your updates. These are ordinary instructions, NOT downloadable model weights or ChatGPT's hidden reasoning. The underlying Kimi Q2 model does not become GPT-6; it still needs careful verification for large generated code files.

A request like "can you search the web for cool tech releases this month" now uses the actual search terms, and "make a .py platformer using pygame" proposes `platformer.py` for approval. Source-file generation has a higher output limit than ordinary chat; all writes still require typing `APPLY`.


## v0.4.8: Permissions and local learning

Kivo can now reduce routine approvals while preserving safeguards:

```text
/permissions trusted
/shell git status
/shell Get-ChildItem
/permissions ask
```

`trusted` persists between launches. It only auto-runs exact, read-only allowlisted commands. Every other shell command still asks for `RUN`, and editing files always asks for `APPLY`. Use `/permissions` to see your current setting. Web searches are already automatic.

### Learn from mistakes and internet research

```text
/learn
/learn on
/learn correction A Pygame platformer must include a complete event loop and quit handling.
/learn success Fixing import paths resolved my Python startup error.
/learn list
/learn web https://www.python.org/doc/
/learn forget LESSON_ID
/learn off
```

Kivo saves lessons and settings in `%USERPROFILE%\.projectmate-kimi\` (unless you configured a different `PROJECTMATE_KIMI_HOME`). On `on`, it can automatically record observable failures (for example a command failing or malformed generated code), and store the titles and URLs of web search results. The user can explicitly add confirmed corrections and successes. It retrieves only small relevant notes at the next related request. Internet notes are treated as untrusted, time-sensitive data and must be rechecked before factual claims. This is retrieval memory, **not** neural network training, and cannot make a weak local model equivalent to GPT-6.

**Privacy:** stored lessons can include search topics, source links, and command-error excerpts. Review `/learn list` and delete records you don't want saved. `/learn off` stops automatic capture and retrieval; `/learn clear` prompts before erasing all records. For shared computers, keep the account protected.

## v0.4.9: Source-based online research and typo-aware routing

When you ask “can you learn from pypame forums online?”, Kivo now normalizes the typo to Pygame, searches public sites, attempts to read relevant public pages, and saves short source-linked excerpts **only after successful page fetches**. This avoids handing the task to the small model's unreliable tool planner, which previously invented `file.py`.

Try:

```text
/learn on
can you learn from pypame forums online?
/learn list
/research pygame beginner event handling discussions
/learn research pygame community platformer tutorials
```

Research results are **unverified outside material**, not new rules or changes to model weights. Kivo doesn't execute commands from pages and refuses to claim learning when providers are blocked. You can review/delete lessons with `/learn list`, `/learn forget ID`, and `/learn clear`. Public search providers can reject automated access. Web requests remain HTTPS-only and exclude local/private network addresses.


## v0.5.0 — Repetition-loop protection

If the small Q2 Kimi model gets stuck repeating sentences such as `Do not lie about what you know`, Kivo now detects the repetition *while generating*, aborts that answer before wasting the whole response budget, and retries **once** with a minimal clean system prompt (no old chat history, lessons, or editable brain instructions). If the model loops again, it shows a plain fallback rather than printing/saving a broken reply. Previously saved looping answers are filtered out when constructing chat context; your underlying chat and project files are not deleted automatically.

After updating, launch Kivo and type `/clear` once if you want to remove the broken conversation from your saved session. `/clear` does not erase project notes or learning memories. If a remembered lesson is wrong, review `/learn list` and use `/learn forget ID`; don't use `/learn clear` unless you intend to erase everything.

These checks fix application-level feedback loops, but they do **not** change or retrain the Q2 Kimi model. If you see the same loop directly in `ollama run MODEL`, try a better quantisation or a different compatible model for higher-quality answers. No cloud credits are required.

## v0.5.2: Python code safety and Pygame fallback

If the Kimi Q2 model outputs English sentences instead of Python, Kivo now rejects the draft. It verifies Python syntax with `ast.parse`, without running the generated code. For a generic Pygame game request, it can offer a clearly marked bundled playable starter instead, subject to the same `APPLY` approval. This fallback is not model-generated and does not mean Kimi has been fixed.

Python 3 must be on PATH or available through `py -3` for verification. To run the bundled Pygame game, first install pygame with `py -3 -m pip install pygame` and then run `py -3 main.py` within the selected project directory.

The update doesn't erase old chat history, project files, or learning notes. Use `/read main.py` to inspect any old broken source; `/undo` may restore the last edit, or `/edit main.py make it a complete pygame platformer` will offer an approved replacement when the old file contains only prose. You can delete misleading saved lessons individually with `/learn forget ID`.

Routine `/search` results are no longer treated as learned facts. `/research` still saves substantive source-linked excerpts when explicitly requested. `/version` should show `Kivo 0.5.2`.


### Memory routing fix (v0.6.2)

Kivo handles direct memory requests without model planning, e.g. `can you update your memory that my name is Zak and i am a young developer` or `/memory remember my name is Zak`. It records explicitly requested identity facts even though automatic memory remains limited to technical preferences/project facts. Saved facts are stored under `.projectmate-kimi/memory.json`, shown with `/memory list`, and removable with `/memory forget ID`. Explicit facts are blocked when memory mode is off. Context resizing and tool approval rules are unchanged.
