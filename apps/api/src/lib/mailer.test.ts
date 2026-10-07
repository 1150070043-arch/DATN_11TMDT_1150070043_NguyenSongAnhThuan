import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { orderStatusMailContent, sendMail, type SmtpSettings } from "./mailer.js";

test("delivers a multipart message through a real SMTP conversation", async () => {
  let transcript = "";
  let dataMode = false;
  let dataBuffer = "";
  const server = net.createServer((socket) => {
    socket.write("220 bookguard-test ESMTP\r\n");
    socket.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      transcript += text;
      if (dataMode) {
        dataBuffer += text;
        if (dataBuffer.includes("\r\n.\r\n")) {
          dataMode = false;
          dataBuffer = "";
          socket.write("250 queued\r\n");
        }
        return;
      }
      for (const line of text.split("\r\n").filter(Boolean)) {
        if (line.startsWith("EHLO")) socket.write("250-bookguard-test\r\n250 8BITMIME\r\n");
        else if (line.startsWith("MAIL FROM:")) socket.write("250 sender ok\r\n");
        else if (line.startsWith("RCPT TO:")) socket.write("250 recipient ok\r\n");
        else if (line === "DATA") {
          dataMode = true;
          socket.write("354 end with dot\r\n");
        } else if (line === "QUIT") {
          socket.write("221 bye\r\n");
          socket.end();
        }
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("SMTP test server did not expose a TCP port.");
    }
    const smtp: SmtpSettings = {
      host: "127.0.0.1",
      port: address.port,
      secure: false,
      user: "",
      password: "",
      fromAddress: "no-reply@bookguard.local",
      fromName: "Thư An Bookstore"
    };
    await sendMail(
      {
        to: "student@example.test",
        subject: "SMTP integration check",
        text: "Nội dung văn bản",
        html: "<p>Nội dung HTML</p>"
      },
      smtp
    );

    assert.match(transcript, /MAIL FROM:<no-reply@bookguard\.local>/);
    assert.match(transcript, /RCPT TO:<student@example\.test>/);
    assert.match(transcript, /Content-Type: multipart\/alternative/);
    assert.match(transcript, /Content-Transfer-Encoding: base64/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("order status email contains order data and escapes customer HTML", () => {
  const content = orderStatusMailContent({
    to: "reader@example.test",
    customerName: "<img src=x onerror=alert(1)>",
    orderId: 148,
    status: "shipping",
    totalAmount: 428000
  });

  assert.match(content.subject, /#148/);
  assert.match(content.text, /trên đường/);
  assert.match(content.text, /428\.000/);
  assert.doesNotMatch(content.html, /<img src=x/);
  assert.match(content.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
