/** Factual self-description should not rely on a heavily quantised small model. */
export function identityResponse(prompt) {
  const text=String(prompt).toLowerCase().replace(/[’]/g,"'").replace(/[^a-z0-9'? ]+/g,' ').trim();
  if (/^(?:(?:can|could|would) you (?:please )?)?(?:tell me (?:everything|all) about (?:you|yourself)|tell me about yourself|describe yourself|what can you (?:do|help with))(?:\?)?$/.test(text)) {
    return "I'm Kivo, a local AI assistant that runs through Ollama using an installed model such as Kimi or Qwen. I can help with programming, reviewing source files, planning edits, searching public webpages, and checking code. I can store project notes and preferences locally when enabled, but that isn't the same as retraining my model. I may make mistakes, especially with smaller models, so I should verify tool results and ask before changing files or running untrusted commands. You can use /help, /status, /memory, /smart and /context to see how I'm configured.";
  }
  if (/^(?:wait so |so )?(?:what (?:do you think you are|are you|kind of (?:thing|ai) are you)|who are you|are you (?:a )?(?:bot|ai|human|person|robot)|(?:you're|you are) (?:a )?(?:human|person|bot|ai))(?:\?)?$/.test(text)) {
    if (/\b(?:you are|you're) (?:a )?(?:human|person)/.test(text))
      return "I'm an AI assistant, not a human — but I'm here to help!";
    return "I'm Kivo, a local AI assistant using Ollama and your installed models. I'm software, not a human, and I can help with chatting, coding and tools.";
  }
  return null;
}

export function isFalseSelfDescription(reply) {
  const text=String(reply).toLowerCase().replace(/[’]/g,"'");
  return /\b(?:i am|i'm) (?:not (?:a )?bot|not (?:an )?ai|(?:a )?human|(?:a )?real person)\b/.test(text)
    || /\byou are (?:the|a) bot\b/.test(text)
    || (/\b(?:i am|i'm) (?:a )?bot\b/.test(text) && /\b(?:i am not|i'm not) (?:a )?bot\b/.test(text));
}

export function fallbackFriendlyReply(prompt) {
  const msg=String(prompt).toLowerCase();
  if (/\b(?:lie|lying|honest|truthful)\b/.test(msg)) return "I can make mistakes or invent inaccurate details. I should admit when I'm uncertain and distinguish verified facts from guesses, rather than pretending to know.";
  if (/\b(?:what do you know|what can you do)\b/.test(msg)) return "I can help explain coding, technology and your projects using what you've shared. I can't claim to have checked a file or website unless a tool actually did so.";
  if (/\b(?:are you okay|you alright|are you alright)\b/.test(msg)) return "My last response hit a repetition bug, but the program is still running. We can try again with a clean conversation.";
  if (/\b(?:kind|nice|sweet|friendly)\b/.test(msg)) return "Thanks! I try to be helpful and kind.";
  if (/\b(?:fym|what do you mean|what's that supposed to mean)\b/.test(msg)) return "I phrased that badly. I'm Kivo, a local AI assistant — not a person. What would you like me to help with?";
  return "Sorry, the local model got stuck repeating itself. I discarded that answer. Try asking again or switch to a different model.";
}
