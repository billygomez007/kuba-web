(function () {
  const script = document.currentScript;
  const publicKey = script?.dataset.publicKey;

  if (!publicKey) {
    console.error(
      "Kuba Chat: data-public-key is required."
    );
    return;
  }

  const KUBA_API =
    "https://kuba-web-woad.vercel.app";

  const button = document.createElement("button");

  button.innerHTML = "💬";

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
    boxShadow:
      "0 8px 30px rgba(0,0,0,.25)",
  });

  document.body.appendChild(button);

  const box = document.createElement("div");

  Object.assign(box.style, {
    position: "fixed",
    right: "25px",
    bottom: "100px",
    width: "320px",
    height: "420px",
    background: "#111",
    color: "white",
    borderRadius: "18px",
    boxShadow:
      "0 15px 50px rgba(0,0,0,.3)",
    zIndex: "999999",
    display: "none",
    overflow: "hidden",
    fontFamily:
      "Arial, sans-serif",
  });

  box.innerHTML = `
    <div style="
      padding:16px;
      background:#06b6d4;
      font-weight:700;
      color:white;
    ">
      Kuba AI
    </div>

    <div
      id="kuba-messages"
      style="
        height:310px;
        overflow-y:auto;
        padding:14px;
      "
    ></div>

    <div style="
      display:flex;
      border-top:1px solid #333;
    ">
      <input
        id="kuba-input"
        type="text"
        placeholder="Type your message..."
        style="
          flex:1;
          padding:12px;
          border:none;
          outline:none;
          background:#181818;
          color:white;
        "
      />

      <button
        id="kuba-send"
        style="
          padding:12px 15px;
          border:none;
          background:#06b6d4;
          color:white;
          cursor:pointer;
        "
      >
        Send
      </button>
    </div>
  `;

  document.body.appendChild(box);

  const messages =
    box.querySelector("#kuba-messages");

  const input =
    box.querySelector("#kuba-input");

  const send =
    box.querySelector("#kuba-send");

  let conversationId = "";

  function addMessage(sender, text) {
    const wrapper =
      document.createElement("div");

    wrapper.style.marginBottom = "12px";

    wrapper.innerHTML = `
      <div style="
        font-size:11px;
        opacity:.55;
        margin-bottom:3px;
      ">
        ${sender}
      </div>

      <div style="
        background:#1d1d1d;
        padding:10px;
        border-radius:10px;
        line-height:1.4;
      ">
        ${String(text)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>")}
      </div>
    `;

    messages.appendChild(wrapper);

    messages.scrollTop =
      messages.scrollHeight;
  }

  button.addEventListener(
    "click",
    () => {
      box.style.display =
        box.style.display === "none"
          ? "block"
          : "none";
    }
  );

  async function sendMessage() {
    const text =
      input.value.trim();

    if (!text) return;

    addMessage("You", text);

    input.value = "";

    send.disabled = true;

    try {
      const response =
        await fetch(
          `${KUBA_API}/api/integrations/website-chat`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },

            body:
              JSON.stringify({
                publicKey,
                message: text,
                conversationId,
              }),
          }
        );

      const raw =
        await response.text();

      let data = null;

      try {
        data = raw
          ? JSON.parse(raw)
          : null;
      } catch {
        console.error(
          "Kuba returned non-JSON:",
          raw
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Kuba API returned HTTP ${response.status}`
        );
      }

      if (!data) {
        throw new Error(
          "Kuba returned an empty response."
        );
      }

      if (
        data.conversationId
      ) {
        conversationId =
          data.conversationId;
      }

      addMessage(
        "Kuba",
        data.response ||
          "I'm sorry, I couldn't respond right now."
      );

    } catch (error) {
      console.error(
        "Kuba Chat error:",
        error
      );

      addMessage(
        "Kuba",
        error instanceof Error
          ? error.message
          : "Sorry, something went wrong. Please try again."
      );

    } finally {
      send.disabled = false;
      input.focus();
    }
  }

  send.addEventListener(
    "click",
    sendMessage
  );

  input.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        sendMessage();
      }
    }
  );
})();
