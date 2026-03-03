import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import Config


def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP code."""
    return "".join(random.choices(string.digits, k=length))


def send_otp_email(to_email: str, otp_code: str, name: str) -> None:
    """Send OTP verification email via configured SMTP server."""
    subject = "Mo-Ride: Your verification code"
    body_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1B5E20; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">🚗 Mo-Ride</h1>
            <p style="color: #A5D6A7; margin: 5px 0 0;">Monash University Ride Sharing</p>
        </div>
        <div style="border: 1px solid #e0e0e0; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2>Hi {name},</h2>
            <p>Your Mo-Ride verification code is:</p>
            <div style="text-align: center; margin: 30px 0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px;
                             color: #1B5E20; background: #F1F8E9; padding: 15px 25px;
                             border-radius: 8px; border: 2px dashed #66BB6A;">
                    {otp_code}
                </span>
            </div>
            <p>This code expires in <strong>10 minutes</strong>.</p>
            <p style="color: #888; font-size: 14px;">
                If you didn't request this, you can safely ignore this email.
            </p>
        </div>
    </body>
    </html>
    """
    body_text = f"Hi {name},\n\nYour Mo-Ride verification code is: {otp_code}\n\nThis code expires in 10 minutes."

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = Config.SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    try:
        if Config.SMTP_TLS:
            server = smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT)
            server.ehlo()
            server.starttls()
            if Config.SMTP_USER:
                server.login(Config.SMTP_USER, Config.SMTP_PASS)
        else:
            server = smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT)

        server.sendmail(Config.SMTP_FROM, [to_email], msg.as_string())
        server.quit()
    except Exception as e:
        # Log but don't crash — OTP is also stored in DB for dev inspection
        print(f"[email_utils] Failed to send email: {e}")
        raise
