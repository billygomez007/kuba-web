(function () {
  const script =
    document.currentScript;

  const publicKey =
    script?.dataset.publicKey;

  if (!publicKey) {
    console.error(
      "Kuba Chat: data-public-key is required."
    );
    return;
  }

  const button =
    document.createElement("button");

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

  const box =
    document.createElement("div");

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
    boxShadow:
      "0 20px 50px rgba(0,0,0,.35)",
    boxSizing: "border-box",
  });

  box.innerHTML = `
    <div style="
      font-weight:bold;
      font-size:18px;
      margin-bottom:15px;
    ">
      Kuba AI
    </div>

    <div
      id="kuba-messages"
      style="
        height:320px;
        overflow:auto;
        margin-bottom:10px;
      "
    ></div>

    <input
      id="kuba-input"
      placeholder="Ask us anything..."
      style="
        width:100%;
        padding:10px;
        border-radius:10px;
        border:none;
        box-sizing:border-box;
        color:#111;
      "
    />
  `;

  document.body.appendChild(box);

  button.onclick =
    function () {
      box.style.display =
        box.style.display === "none"
          ? "block"
          : "none";
    };

  const input =
    box.querySelector(
      "#kuba-input"
    );

  const messages =
    box.querySelector(
      "#kuba-messages"
    );

  let conversationId =
    null;

  function addMessage(
    sender,
    text
  ) {
    const item =
      document.createElement("p");

    item.style.margin =
      "8px 0";

    const strong =
      document.createElement("b");

    strong.textContent =
      sender + ":";

    item.appendChild(strong);

    item.appendChild(
      document.createTextNode(
        " " + text
      )
    );

    messages.appendChild(item);

    messages.scrollTop =
      messages.scrollHeight;
  }

  async function sendMessage() {
    const text =
      input.value.trim();

    if (!text) return;

    addMessage(
      "You",
      text
    );

    input.value = "";

    try {
      const response =
        await fetch(
          "/api/integrations/website-chat",
          {
            method: "POST",
            headers: {
              "Content-Type":
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

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to contact Kuba."
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
          "I’m sorry, I couldn't respond right now."
      );
    } catch (error) {
      console.error(
        "Kuba Chat error:",
        error
      );

      addMessage(
        "Kuba",
        "Sorry, something went wrong. Please try again."
      );
    }
  }

  input.addEventListener(
    "keypress",
    function (event) {
      if (
        event.key === "Enter"
      ) {
        sendMessage();
      }
    }
  );
})();
