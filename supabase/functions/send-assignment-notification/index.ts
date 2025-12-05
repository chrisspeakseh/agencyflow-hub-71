import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssignmentNotification {
  taskId: string;
  taskTitle: string;
  assigneeEmail: string;
  assigneeName: string;
  projectName: string;
  dueDate?: string;
  priority: string;
  action: "assigned" | "unassigned";
}

async function sendEmail(to: string, subject: string, body: string) {
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");

  if (!smtpHost || !smtpUser || !smtpPassword) {
    console.log("SMTP not configured, skipping email");
    return false;
  }

  console.log("Connecting to SMTP server:", smtpHost);

  try {
    const conn = await Deno.connect({
      hostname: smtpHost,
      port: smtpPort,
      transport: "tcp",
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const tlsConn = await Deno.startTls(conn, { hostname: smtpHost });

    const greeting = new Uint8Array(1024);
    await tlsConn.read(greeting);
    console.log("Server greeting:", decoder.decode(greeting));

    await tlsConn.write(encoder.encode(`EHLO ${smtpHost}\r\n`));
    const ehloResp = new Uint8Array(1024);
    await tlsConn.read(ehloResp);

    await tlsConn.write(encoder.encode("AUTH LOGIN\r\n"));
    const authResp = new Uint8Array(1024);
    await tlsConn.read(authResp);

    const username = btoa(smtpUser);
    await tlsConn.write(encoder.encode(`${username}\r\n`));
    const userResp = new Uint8Array(1024);
    await tlsConn.read(userResp);

    const password = btoa(smtpPassword);
    await tlsConn.write(encoder.encode(`${password}\r\n`));
    const passResp = new Uint8Array(1024);
    await tlsConn.read(passResp);

    await tlsConn.write(encoder.encode(`MAIL FROM:<${smtpUser}>\r\n`));
    const mailResp = new Uint8Array(1024);
    await tlsConn.read(mailResp);

    await tlsConn.write(encoder.encode(`RCPT TO:<${to}>\r\n`));
    const rcptResp = new Uint8Array(1024);
    await tlsConn.read(rcptResp);

    await tlsConn.write(encoder.encode("DATA\r\n"));
    const dataResp = new Uint8Array(1024);
    await tlsConn.read(dataResp);

    const emailContent = `From: ${smtpUser}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${body}\r\n.\r\n`;
    await tlsConn.write(encoder.encode(emailContent));
    const contentResp = new Uint8Array(1024);
    await tlsConn.read(contentResp);

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle health checks or empty requests
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    // Safely parse JSON body
    let body: AssignmentNotification;
    try {
      const text = await req.text();
      if (!text || text.trim() === "") {
        console.log("Empty request body received");
        return new Response(
          JSON.stringify({ success: true, message: "No data to process" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
      body = JSON.parse(text);
    } catch (parseError) {
      console.log("Invalid JSON body:", parseError);
      return new Response(
        JSON.stringify({ success: true, message: "Invalid request body" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { taskId, taskTitle, assigneeEmail, assigneeName, projectName, dueDate, priority, action } = body;

    // Validate required fields
    if (!taskId || !assigneeEmail || !action) {
      console.log("Missing required fields");
      return new Response(
        JSON.stringify({ success: true, message: "Missing required fields" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Sending ${action} notification:`, { taskId, assigneeEmail });

    const subject = action === "assigned" 
      ? `Task Assigned: ${taskTitle}` 
      : `Task Unassignment: ${taskTitle}`;
    
    const emailBody = action === "assigned" ? `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0f172a;">Task Assigned to You</h2>
            <p>Hi ${assigneeName},</p>
            <p>You have been assigned to a task in <strong>${projectName}</strong>:</p>
            
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
    ` : `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0f172a;">Task Unassignment</h2>
            <p>Hi ${assigneeName},</p>
            <p>You have been unassigned from a task in <strong>${projectName}</strong>:</p>
            
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #0f172a;">${taskTitle}</h3>
            </div>
            
            <p>You are no longer responsible for this task.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>AgencyFlow Team</strong>
            </p>
          </div>
        </body>
      </html>
    `;

    await sendEmail(assigneeEmail, subject, emailBody);

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-assignment-notification:", error);
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
