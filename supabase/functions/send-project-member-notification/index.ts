import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProjectMemberNotification {
  memberEmail: string;
  memberName: string;
  projectName: string;
  action: "added" | "removed";
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

  // Handle health checks
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    // Safely parse JSON body
    let body: ProjectMemberNotification;
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

    const { memberEmail, memberName, projectName, action } = body;

    // Validate required fields
    if (!memberEmail || !action) {
      console.log("Missing required fields");
      return new Response(
        JSON.stringify({ success: true, message: "Missing required fields" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Sending project member ${action} notification:`, { memberEmail, projectName });

    const subject = action === "added"
      ? `Added to Project: ${projectName}`
      : `Removed from Project: ${projectName}`;
    
    const emailBody = action === "added" ? `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0f172a;">Welcome to the Project Team!</h2>
            <p>Hi ${memberName},</p>
            <p>You have been added to the project team for <strong>${projectName}</strong>.</p>
            
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p>You can now:</p>
              <ul>
                <li>View and manage project tasks</li>
                <li>Collaborate with other team members</li>
                <li>Track project progress</li>
              </ul>
            </div>
            
            <p>Please log in to AgencyFlow to access the project.</p>
            
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
            <h2 style="color: #0f172a;">Removed from Project</h2>
            <p>Hi ${memberName},</p>
            <p>You have been removed from the project team for <strong>${projectName}</strong>.</p>
            
            <p>You will no longer have access to this project's tasks and information.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>AgencyFlow Team</strong>
            </p>
          </div>
        </body>
      </html>
    `;

    await sendEmail(memberEmail, subject, emailBody);

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-project-member-notification:", error);
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
