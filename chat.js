"use strict";

const launcher = document.querySelector("#chat-launcher");
const panel = document.querySelector("#chat-panel");
const closeButton = document.querySelector("#chat-close");
const form = document.querySelector("#chat-form");
const input = document.querySelector("#chat-input");
const sendButton = document.querySelector("#chat-send");
const messagesElement = document.querySelector("#chat-messages");

const conversation = [];
let isSending = false;

function getQuickReply(text) {
  const question = text.toLowerCase();
  const phone = "+234 706 758 7195";
  const email = "jeftech12345@hotmail.com";
  let reply;

  if (/\b(spark|shock|fire|burning|smoke|exposed wire|danger|emergency)\b/.test(question)) {
    reply = "Please keep away from the electrical hazard and do not touch it. If there is immediate danger, contact local emergency services or a qualified electrician.";
  } else if (/\b(where|location|address|located|directions|find you)\b/.test(question)) {
    reply = "JEFTECH’s registered address is 10 Base 10 Estate, World Bank, Owerri, Imo State, Nigeria. For directions or to confirm a visit, please call " + phone + " or email " + email + ".";
  } else if (/\b(price|pricing|cost|quote|quotation|estimate|how much)\b/.test(question)) {
    reply = "We can discuss a quote once we know more about your project. What electrical work do you need, and where is the project? To contact JEFTECH directly, call " + phone + " or email " + email + ".";
  } else if (/\b(service|services|offer|do you do|installation|install|maintenance|repair|design)\b/.test(question)) {
    reply = "JEFTECH provides electrical design, installation, maintenance, and repair for residential, commercial, and industrial purposes. What kind of project can we help you with?";
  } else if (/\b(phone|call|contact|email|number|reach)\b/.test(question)) {
    reply = "You can call JEFTECH on " + phone + " or email " + email + ".";
  } else if (/\b(open|hours|hour|available|availability|working time)\b/.test(question)) {
    reply = "I don’t have JEFTECH’s opening hours or availability. Please call " + phone + " or email " + email + " to check directly.";
  } else if (/\b(rc|registration|registered|company number)\b/.test(question)) {
    reply = "JEFTECH ELECTRICAL ENERGY LTD is active and registered as RC 8918525.";
  } else {
    reply = "I can help with basic questions about JEFTECH’s electrical services and Owerri address. For help with your specific project, call " + phone + " or email " + email + ". What electrical work are you looking for?";
  }

  return reply + " (Quick reply: the live AI service is not connected right now.)";
}

function addMessage(text, role, extraClass = "") {
  const message = document.createElement("div");
  message.className = `chat-message chat-message-${role}${extraClass ? ` ${extraClass}` : ""}`;
  message.textContent = text;
  messagesElement.append(message);
  messagesElement.scrollTop = messagesElement.scrollHeight;
  return message;
}

function setPanelOpen(open) {
  panel.hidden = !open;
  launcher.setAttribute("aria-expanded", String(open));
  launcher.querySelector("span").textContent = open ? "Close chat" : "Chat with us";
  launcher.setAttribute("aria-label", open ? "Close JEFTECH AI chat" : "Open JEFTECH AI chat");
  if (open) input.focus();
  else launcher.focus();
}

async function sendMessage(text) {
  if (isSending) return;
  isSending = true;
  sendButton.disabled = true;
  addMessage(text, "user");

  const typing = addMessage("Thinking…", "assistant", "chat-typing");
  const nextConversation = [...conversation, { role: "user", content: text }];

  try {
    if (window.location.protocol === "file:") {
      const reply = getQuickReply(text);
      conversation.push(
        { role: "user", content: text },
        { role: "assistant", content: reply }
      );
      if (conversation.length > 12) conversation.splice(0, conversation.length - 12);
      typing.remove();
      addMessage(reply, "assistant");
      return;
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: nextConversation })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(result?.error || "The chat service could not respond. Please try again.");
      error.status = response.status;
      throw error;
    }
    if (typeof result?.reply !== "string" || !result.reply.trim()) {
      throw new Error("The chat service returned an empty reply. Please try again.");
    }

    conversation.push(
      { role: "user", content: text },
      { role: "assistant", content: result.reply }
    );
    if (conversation.length > 12) conversation.splice(0, conversation.length - 12);
    typing.remove();
    addMessage(result.reply, "assistant");
  } catch (error) {
    typing.remove();
    if (error.status === 429) {
      addMessage("The chat is receiving too many requests. Please wait a moment and try again.", "assistant", "chat-message-error");
    } else if ([403, 404, 503].includes(error.status) || error.status >= 500 || error instanceof TypeError) {
      const reply = getQuickReply(text);
      conversation.push(
        { role: "user", content: text },
        { role: "assistant", content: reply }
      );
      if (conversation.length > 12) conversation.splice(0, conversation.length - 12);
      addMessage(reply, "assistant");
    } else {
      addMessage(error.message, "assistant", "chat-message-error");
    }
  } finally {
    isSending = false;
    sendButton.disabled = false;
    if (!panel.hidden) input.focus();
  }
}

launcher.addEventListener("click", () => setPanelOpen(panel.hidden));
closeButton.addEventListener("click", () => setPanelOpen(false));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || isSending) return;
  input.value = "";
  input.style.height = "auto";
  void sendMessage(text);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 90)}px`;
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll(".chat-suggestions button").forEach((button) => {
  button.addEventListener("click", () => {
    if (!isSending) void sendMessage(button.dataset.question);
  });
});
