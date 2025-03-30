const {
  default: makeWASocket,
  downloadContentFromMessage,
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  delay: delayin,
} = require("@whiskeysockets/baileys");
const mime = require("mime-types");
const fs = require("fs");
const { join } = require("path");
const { default: axios } = require("axios");

function formatReceipt(receipt) {
  try {
    if (receipt.endsWith("@g.us")) {
      return receipt;
    }
    let phoneWa = receipt.replace(/\D/g, "");
    if (phoneWa === "") {
      return phoneWa;
    } else if (phoneWa.substr(0, 2) == "08") {
      phoneWa = phoneWa.replace(/08/, "628");
    } else if (phoneWa.substr(0, 4) == "6208") {
      phoneWa = phoneWa.replace(/6208/, "628");
      /* Indonesia formatting */
      /* Italy formatting */
    } else if (
      phoneWa.substr(0, 1) == "3" &&
      (phoneWa.length === 9 || phoneWa.length === 10)
    ) {
      phoneWa = "39" + phoneWa;
      /* Italy formatting */
      /* Nigeria formatting */
    } else if (phoneWa.substr(0, 4) == "2340") {
      phoneWa = phoneWa.replace(/2340/, "234");
      /* Nigeria formatting */
      /* Mexico formatting */
    } else if (phoneWa.substr(0, 2) == "52" && phoneWa.substr(2, 1) != "1") {
      phoneWa = phoneWa.replace(/52/, "521");
      /* Mexico formatting */
      /* Argentina formatting */
    } else if (phoneWa.substr(0, 2) == "54" && phoneWa.substr(2, 1) != "9") {
      phoneWa = phoneWa.replace(/54/, "549");
      /* Argentina formatting */
      /* Brazil formatting */
    } else if (phoneWa.substr(0, 2) == "55" && phoneWa.length == 13) {
      let ddd = parseInt(phoneWa.substr(2, 2));
      if (ddd > 30) {
        phoneWa = "55" + ddd + phoneWa.substr(-8);
      }
      /* Brazil formatting */
    }
    // return phoneWa;
    if (!phoneWa.endsWith("@c.us")) {
      phoneWa += "@c.us";
    }
    return phoneWa;

    // return formatted;
  } catch (error) {
    return receipt;
  }

  // }
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

async function removeForbiddenCharacters(input) {
  // remove forbidden characters and allow Arabic letters
  // additionally, escape single quotes
  return input.replace(/[\x00-\x1F\x7F-\x9F'\\"]/g, "");
}

async function parseIncomingMessage(msg) {
  const type = Object.keys(msg.message || {})[0];
  const body =
    type === "conversation" && msg.message.conversation
      ? msg.message.conversation
      : type == "imageMessage" && msg.message.imageMessage.caption
      ? msg.message.imageMessage.caption
      : type == "videoMessage" && msg.message.videoMessage.caption
      ? msg.message.videoMessage.caption
      : type == "extendedTextMessage" && msg.message.extendedTextMessage.text
      ? msg.message.extendedTextMessage.text
      : type == "messageContextInfo" && msg.message.listResponseMessage?.title
      ? msg.message.listResponseMessage.title
      : type == "messageContextInfo"
      ? msg.message.buttonsResponseMessage.selectedDisplayText
      : type == "templateMessage" &&
        msg.message.templateMessage.hydratedTemplate.hydratedContentText
      ? msg.message.templateMessage.hydratedTemplate.hydratedContentText
      : "";

  const d = body.toLowerCase();
  const command = await removeForbiddenCharacters(d);

  const senderName = msg?.pushName || "";
  const from = msg.key.remoteJid.split("@")[0];
  let bufferImage;
  //  const urlImage = (type == 'imageMessage') && msg.message.imageMessage.caption ? msg.message.imageMessage.caption : null;
  if (type === "imageMessage") {
    const stream = await downloadContentFromMessage(
      msg.message.imageMessage,
      "image"
    );
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    bufferImage = buffer.toString("base64");
  } else {
    urlImage = null;
  }

  return { command, bufferImage, from };
}

function getSavedPhoneNumber(number) {
  return new Promise((resolve, reject) => {
    const savedPhoneNumber = number;
    if (savedPhoneNumber) {
      setTimeout(() => {
        resolve(savedPhoneNumber);
      }, 2000);
    } else {
      reject(new Error("Nomor telepon tidak ditemukan."));
    }
  });
}

const prepareMediaMessage = async (sock, mediaMessage) => {
  try {
    const prepareMedia = await prepareWAMessageMedia(
      {
        [mediaMessage.mediatype]: { url: mediaMessage.media },
      },
      {
        upload: sock.waUploadToServer,
      }
    );

    const mediaType = mediaMessage.mediatype + "Message";
    if (mediaMessage.mediatype === "document" && !mediaMessage.fileName) {
      const regex = new RegExp(/.*\/(.+?)\./);
      const arrayMatch = regex.exec(mediaMessage.media);
      mediaMessage.fileName = arrayMatch[1];
    }
    mimetype = mime.lookup(mediaMessage.media);
    if (!mimetype) {
      const head = await axios.head(mediaMessage.media);
      mimetype = head.headers["content-type"];
    }

    if (mediaMessage.media.includes(".cdr")) {
      mimetype = "application/cdr";
    }

    prepareMedia[mediaType].caption = mediaMessage?.caption;
    prepareMedia[mediaType].mimetype = mimetype;
    prepareMedia[mediaType].fileName = mediaMessage.fileName;

    if (mediaMessage.mediatype === "video") {
      prepareMedia[mediaType].jpegThumbnail = Uint8Array.from(
        fs.readFileSync(
          join(process.cwd(), "public", "images", "video-cover.png")
        )
      );
      prepareMedia[mediaType].gifPlayback = false;
    }

    let ownerJid = sock.user.id.replace(/:\d+/, "");
    return await generateWAMessageFromContent(
      "",
      { [mediaType]: { ...prepareMedia[mediaType] } },
      { userJid: ownerJid }
    );
  } catch (error) {
    console.log("error prepare", error);
    return false;
  }
};

// external
const formatMXOrARNumber = (jid) => {
  const regexp = new RegExp(/^(\d{2})(\d{2})\d{1}(\d{8})$/);
  if (regexp.test(jid)) {
    const match = regexp.exec(jid);
    if (match && (match[1] === "52" || match[1] === "54")) {
      const joker = Number.parseInt(match[3][0]);
      const ddd = Number.parseInt(match[2]);
      if (joker < 7 || ddd < 11) {
        return match[0];
      }
      return match[1] === "52" ? "52" + match[3] : "54" + match[3];
    }
  }
  return jid;
};
// Check if the number is br
// Check if the number is id (Indonesia)
const formatIDNumber = (jid) => {
  if (jid.startsWith("0")) {
    return "62" + jid.substring(1);
  } else {
    return jid;
  }
};
const createJid = (number) => {
  if (number.includes("@g.us") || number.includes("@s.whatsapp.net")) {
    return number;
  }

  const formattedBRNumber = formatIDNumber(number);

  if (formattedBRNumber !== number) {
    return `${formattedBRNumber}@s.whatsapp.net`;
  }

  const formattedMXARNumber = formatMXOrARNumber(number);
  if (formattedMXARNumber !== number) {
    return `${formattedMXARNumber}@s.whatsapp.net`;
  }

  if (number.includes("-")) {
    return `${number}@g.us`;
  }

  return `${number}@s.whatsapp.net`;
};

async function delayMsg(delay, sock, recipient) {
  const jid = createJid(recipient);
  await sock.presenceSubscribe(recipient);
  await sock.sendPresenceUpdate("composing", jid);
  await delayin(delay);
  await sock.sendPresenceUpdate("paused", recipient);
}

module.exports = {
  formatReceipt,
  asyncForEach,
  removeForbiddenCharacters,
  parseIncomingMessage,
  getSavedPhoneNumber,
  prepareMediaMessage,
  createJid,
  delayMsg,
};
