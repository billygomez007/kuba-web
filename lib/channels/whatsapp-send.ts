export async function sendWhatsAppMessage(
  phone: string,
  message: string,
) {

  const response =
    await fetch(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",

        headers: {
          "Authorization":
            `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({

          messaging_product:
            "whatsapp",

          to:
            phone,

          type:
            "text",

          text: {
            body:
              message,
          },

        }),
      },
    );


  const data =
    await response.json();


  return {
    success:
      response.ok,

    data,
  };

}
