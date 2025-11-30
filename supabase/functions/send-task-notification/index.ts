import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskNotification {
  taskId: string;
  taskTitle: string;
  assigneeEmail: string;
  assigneeName: string;
  projectName: string;
  dueDate?: string;
  priority: string;
}

async function sendEmail(to: string, subject: string, body: string) {
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");

  console.log("Connecting to SMTP server:", smtpHost);

  try {
    const conn = await Deno.connect({
      hostname: smtpHost!,
      port: smtpPort,
      transport: "tcp",
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Upgrade to TLS if using port 465 (implicit TLS)
    const tlsConn = await Deno.startTls(conn, { hostname: smtpHost! });

    // Read greeting
    const greeting = new Uint8Array(1024);
    await tlsConn.read(greeting);
    console.log("Server greeting:", decoder.decode(greeting));

    // EHLO
    await tlsConn.write(encoder.encode(`EHLO ${smtpHost}\r\n`));
    const ehloResp = new Uint8Array(1024);
    await tlsConn.read(ehloResp);
    console.log("EHLO response:", decoder.decode(ehloResp));

    // AUTH LOGIN
    await tlsConn.write(encoder.encode("AUTH LOGIN\r\n"));
    const authResp = new Uint8Array(1024);
    await tlsConn.read(authResp);

    // Send username (base64 encoded)
    const username = btoa(smtpUser!);
    await tlsConn.write(encoder.encode(`${username}\r\n`));
    const userResp = new Uint8Array(1024);
    await tlsConn.read(userResp);

    // Send password (base64 encoded)
    const password = btoa(smtpPassword!);
    await tlsConn.write(encoder.encode(`${password}\r\n`));
    const passResp = new Uint8Array(1024);
    await tlsConn.read(passResp);
    console.log("Auth response:", decoder.decode(passResp));

    // MAIL FROM
    await tlsConn.write(encoder.encode(`MAIL FROM:<${smtpUser}>\r\n`));
    const mailResp = new Uint8Array(1024);
    await tlsConn.read(mailResp);

    // RCPT TO
    await tlsConn.write(encoder.encode(`RCPT TO:<${to}>\r\n`));
    const rcptResp = new Uint8Array(1024);
    await tlsConn.read(rcptResp);

    // DATA
    await tlsConn.write(encoder.encode("DATA\r\n"));
    const dataResp = new Uint8Array(1024);
    await tlsConn.read(dataResp);

    // Email content
    const emailContent = `From: ${smtpUser}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${body}\r\n.\r\n`;
    await tlsConn.write(encoder.encode(emailContent));
    const contentResp = new Uint8Array(1024);
    await tlsConn.read(contentResp);
    console.log("Content response:", decoder.decode(contentResp));

    // QUIT
    await tlsConn.write(encoder.encode("QUIT\r\n"));
    const quitResp = new Uint8Array(1024);
    await tlsConn.read(quitResp);

    tlsConn.close();
    console.log("Email sent successfully to:", to);
    return true;
  } catch (error) {
    console.error("SMTP error:", error);
    throw error;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { taskId, taskTitle, assigneeEmail, assigneeName, projectName, dueDate, priority }: TaskNotification = await req.json();

    console.log("Sending task notification:", { taskId, assigneeEmail });

    const subject = `New Task Assigned: ${taskTitle}`;
    const body = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0f172a;">New Task Assigned</h2>
            <p>Hi ${assigneeName},</p>
            <p>You have been assigned a new task in <strong>${projectName}</strong>:</p>
            
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #0f172a;">${taskTitle}</h3>
              <p><strong>Priority:</strong> ${priority}</p>
              ${dueDate ? `<p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>` : ''}
            </div>
            
            <p>Please log in to AgencyFlow to view the task details and start working on it.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>AgencyFlow Team</strong>
            </p>
          </div>
        </body>
      </html>
    `;

    await sendEmail(assigneeEmail, subject, body);

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-task-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
