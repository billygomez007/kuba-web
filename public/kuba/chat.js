(function () {
  const script = document.currentScript;
  const widgetMarker = "[data-kuba-chat-widget]";
  const maxWelcomeLength = 500;

  // A duplicate embed must not create a second launcher, conversation, or
  // welcome message on the same page.
  if (!script || document.querySelector(widgetMarker)) return;

  const publicKey = script.dataset.publicKey;
  const welcomeMessage =
    typeof script.dataset.welcome === "string"
      ? script.dataset.welcome.trim().slice(0, maxWelcomeLength)
      : "";

  const kubaApi =
    script.dataset.apiUrl ||
    (script.src ? new URL(script.src).origin : "https://superkuba.com");

  if (!publicKey) {
    console.error("Kuba Chat: data-public-key is required.");
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "💬";
  button.setAttribute("aria-label", "Open Kuba AI chat");
  button.dataset.kubaChatWidget = "launcher";

  Object.assign(button.style, {
    position: "fixed",
    right: "25px",
    bottom: "25px",
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    border: "none",
    background: "#06b6d4",
    color: "white",
    fontSize: "28px",
    cursor: "pointer",
    zIndex: "999999",
    boxShadow: "0 8px 30px rgba(0,0,0,.25)",
  });

  document.body.appendChild(button);

  const box = document.createElement("div");
  box.dataset.kubaChatWidget = "panel";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Kuba AI chat");

  Object.assign(box.style, {
    position: "fixed",
    right: "25px",
    bottom: "100px",
    width: "320px",
    height: "420px",
    background: "#111",
    color: "white",
    borderRadius: "20px",
    padding: "20px",
    display: "none",
    zIndex: "999999",
    boxShadow: "0 20px 50px rgba(0,0,0,.35)",
    boxSizing: "border-box",
  });

  const title = document.createElement("div");
  title.textContent = "Kuba AI";
  Object.assign(title.style, {
    fontWeight: "bold",
    fontSize: "18px",
    marginBottom: "15px",
  });
  box.appendChild(title);

  const messages = document.createElement("div");
  messages.id = "kuba-messages";
  Object.assign(messages.style, {
    height: "320px",
    overflow: "auto",
    marginBottom: "10px",
  });
  box.appendChild(messages);

  const input = document.createElement("input");
  input.id = "kuba-input";
  input.type = "text";
  input.placeholder = "Ask us anything...";
  Object.assign(input.style, {
    width: "100%",
    padding: "10px",
    borderRadius: "10px",
    border: "none",
    boxSizing: "border-box",
    color: "#111",
  });
  box.appendChild(input);

  document.body.appendChild(box);

  button.addEventListener("click", function () {
    box.style.display = box.style.display === "none" ? "block" : "none";
  });

  let conversationId = null;

  function addMessage(sender, text) {
    const item = document.createElement("p");
    item.style.margin = "8px 0";

    const strong = document.createElement("b");
    strong.textContent = `${sender}:`;
    item.appendChild(strong);
    item.appendChild(document.createTextNode(` ${text}`));

    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  // The page-level data attribute is the explicit welcome override. It is
  // rendered through textContent/createTextNode, never as HTML.
  if (welcomeMessage) addMessage("Kuba", welcomeMessage);

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    addMessage("You", text);
    input.value = "";

    try {
      const response = await fetch(`${kubaApi}/api/integrations/website-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, message: text, conversationId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to contact Kuba.");
      }

      if (data.conversationId) conversationId = data.conversationId;
      addMessage("Kuba", data.response || "I’m sorry, I couldn't respond right now.");
    } catch (error) {
      console.error("Kuba Chat error:", error);
      addMessage("Kuba", "Sorry, something went wrong. Please try again.");
    }
  }

  input.addEventListener("keypress", function (event) {
    if (event.key === "Enter") sendMessage();
  });
})();
