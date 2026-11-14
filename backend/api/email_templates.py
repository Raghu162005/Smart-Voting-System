"""
Smart Voting System — HTML Email Templates

Reusable, responsive, email-safe HTML templates for:
  • OTP verification
  • Election result notifications

Design tokens (inline-safe):
  BG_DARK      #07111F
  BG_NAVY      #0B1A2E
  PRIMARY      #4F7CFF
  SECONDARY    #7C5CFC
  ACCENT       #22C55E
  WHITE        #FFFFFF
  TEXT         #111827
  MUTED        #64748B
  CARD_BG      #FFFFFF
  BORDER       #E2E8F0
"""

from html import escape

# ── Brand colours ─────────────────────────────────────────────
BG_DARK   = "#07111F"
BG_NAVY   = "#0B1A2E"
PRIMARY   = "#4F7CFF"
SECONDARY = "#7C5CFC"
ACCENT    = "#22C55E"
WHITE     = "#FFFFFF"
TEXT_DARK = "#111827"
MUTED     = "#64748B"
CARD_BG   = "#FFFFFF"
BORDER    = "#E2E8F0"
RED       = "#EF4444"

# ── Shared helpers ────────────────────────────────────────────

def _email_wrapper(inner_html: str, preheader: str = "Smart Voting System") -> str:
    """Wrap body content in a full email-safe HTML document.

    ``preheader`` is the hidden preview line shown next to the subject in most
    clients; a meaningful value helps recipients recognise the mail.
    """
    return (
        "<!DOCTYPE html>"
        '<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">'
        "<head>"
        '<meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        "<title>Smart Voting System</title>"
        "<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->"
        "<style>"
        "body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}"
        "table,td{mso-table-lspace:0;mso-table-rspace:0}"
        "img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}"
        "body{margin:0;padding:0;width:100%!important;height:100%!important;background-color:#f1f5f9}"
        "@media only screen and (max-width:600px){.email-container{width:100%!important;max-width:100%!important}.fluid{max-width:100%!important;height:auto!important}.stack-column,.stack-column-center{display:block!important;width:100%!important;max-width:100%!important}.stack-column-center{text-align:center!important}}"
        "@media only screen and (max-width:400px){.otp-digit{width:22px!important;margin:0 2px!important}}"
        "@media only screen and (min-width:401px){.otp-digit{width:36px!important;margin:0 3px!important}}"
        "</style>"
        "</head>"
        '<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiysis">'
        '<center style="width:100%;background-color:#f1f5f9">'
        "<!-- preheader (hidden preview text) -->"
        '<div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">' + escape(preheader) + "</div>"
        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f1f5f9">'
        "<tr><td align=\"center\" style=\"padding:24px 12px\">"
        '<!-- outer container -->'
        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width:600px;margin:0 auto">'
        + inner_html +
        "</table>"
        "</td></tr></table></center></body></html>"
    )


def _header_row() -> str:
    """Gradient header with brand name."""
    return (
        "<tr><td style=\"background:linear-gradient(135deg," + PRIMARY + " 0%," + SECONDARY + " 100%);"
        "padding:32px 40px 28px;border-radius:16px 16px 0 0;text-align:center\">"
        '<!-- SVG shield icon -->'
        '<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto 10px">'
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
        '<path d="M9 12l2 2 4-4" stroke="' + ACCENT + '" stroke-width="2.2"/>'
        "</svg>"
        '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,.85)">SMART VOTING SYSTEM</div>'
        '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1px;color:rgba(255,255,255,.55);margin-top:4px">Secure Digital Democracy</div>'
        "</td></tr>"
    )


def _footer_row() -> str:
    """Dark footer."""
    return (
        "<tr><td style=\"background-color:" + BG_NAVY + ";padding:24px 40px;border-radius:0 0 16px 16px;text-align:center\">"
        '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,.45);line-height:1.7">'
        '<span style="color:' + ACCENT + '">&#9679;</span> Secure &nbsp;&nbsp; '
        '<span style="color:' + PRIMARY + '">&#9679;</span> Transparent &nbsp;&nbsp; '
        '<span style="color:' + SECONDARY + '">&#9679;</span> Trusted'
        "</div>"
        '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:10px;color:rgba(255,255,255,.3);margin-top:12px">'
        "&copy; 2026 Smart Voting System. All rights reserved.<br>"
        "This is a system-generated email. Please do not reply."
        "</div>"
        "</td></tr>"
    )


def _spacer(height: int = 24) -> str:
    return f'<tr><td style="height:{height}px;font-size:1px;line-height:1px">&nbsp;</td></tr>'


# ══════════════════════════════════════════════════════════════
#  OTP EMAIL
# ══════════════════════════════════════════════════════════════

def build_otp_email(otp: str, expires_in_minutes: int = 10) -> tuple:
    """Return ``(subject, plain_body, html_body)`` for the OTP email.

    A matching plain-text part is important for deliverability: messages with
    only an HTML part (or with a large HTML:plain ratio) are more likely to be
    filtered. ``expires_in_minutes`` is shown to the recipient and must match
    the server-side OTP lifetime.
    """
    subject = "Smart Voting System verification code"

    expires_in_minutes = max(1, int(expires_in_minutes))

    # ── Plain-text alternative ────────────────────────────────
    plain_body = (
        "Smart Voting System - Email Verification\n"
        "\n"
        f"Your one-time verification code is: {otp}\n"
        "\n"
        f"This code expires in {expires_in_minutes} minutes.\n"
        "\n"
        "Enter this code in the Smart Voting System to verify your identity and\n"
        "continue casting your vote. This is an automated security message; it\n"
        "was sent because an identity verification was requested for the\n"
        "registered voter account linked to this email address.\n"
        "\n"
        "For your security:\n"
        "  - Never share this code with anyone.\n"
        "  - Smart Voting System staff will never ask you for this code.\n"
        "  - If you did not request this code, you can safely ignore this email.\n"
        "\n"
        "Thank you,\n"
        "Smart Voting System\n"
        "\n"
        "This is a system-generated email. Please do not reply.\n"
    )

    # ── HTML alternative ──────────────────────────────────────
    otp_digits_html = "".join(
        f'<span class="otp-digit" style="display:inline-block;width:26px;text-align:center;margin:0 1px">'
        f'{escape(d)}</span>'
        for d in str(otp)
    )

    body = (
        _email_wrapper(
            _header_row()
            + _spacer(0)
            + '<tr><td style="background-color:' + CARD_BG + ';padding:40px 40px 0">'
            # icon
            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="72" style="margin:0 auto">'
            "<tr><td style=\"background:linear-gradient(135deg," + PRIMARY + "," + SECONDARY + ");width:72px;height:72px;border-radius:50%;text-align:center\">"
            '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;margin-top:18px">'
            '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>'
            '<path d="M7 11V7a5 5 0 0110 0v4"/>'
            "</svg>"
            "</td></tr></table>"
            # heading
            '<h1 style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:' + TEXT_DARK + ';text-align:center;margin:24px 0 6px">Verify your identity</h1>'
            '<p style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:' + MUTED + ';text-align:center;margin:0 0 28px;line-height:1.6">'
            "Use the one-time code below to continue with your Smart Voting System session."
            "</p>"
            "</td></tr>"
            # OTP card
            + '<tr><td style="background-color:' + CARD_BG + ';padding:0 40px">'
            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">'
            "<tr><td style=\"background:linear-gradient(135deg," + BG_DARK + "," + BG_NAVY + ");border-radius:14px;padding:28px 20px;text-align:center;border:1px solid rgba(79,124,255,.25)\">"
            f'<div style="font-family:\'Courier New\',Courier,monospace;font-size:36px;font-weight:700;color:{WHITE};line-height:1;white-space:nowrap;text-align:center">{otp_digits_html}</div>'
            "</td></tr></table>"
            "</td></tr>"
            # info text + expiry
            + '<tr><td style="background-color:' + CARD_BG + ';padding:28px 40px 0">'
            '<p style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:' + MUTED + ';text-align:center;margin:0 0 8px;line-height:1.6">'
            "This code is required to verify your identity and continue voting."
            "</p>"
            f'<p style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:{TEXT_DARK};font-weight:600;text-align:center;margin:0 0 24px;line-height:1.6">'
            f"This code expires in {expires_in_minutes} minutes."
            "</p>"
            # security box
            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">'
            "<tr><td style=\"background-color:#F8FAFC;border:1px solid " + BORDER + ";border-radius:12px;padding:20px 24px\">"
            '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;color:' + TEXT_DARK + ';text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">'
            "&#128274; &nbsp;For your security"
            "</div>"
            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">'
            "<tr><td style=\"padding:4px 0\"><span style=\"font-size:13px;color:" + MUTED + ";line-height:1.6\">&#8226;&nbsp;&nbsp;Never share this code with anyone.</span></td></tr>"
            "<tr><td style=\"padding:4px 0\"><span style=\"font-size:13px;color:" + MUTED + ";line-height:1.6\">&nbsp;&nbsp;Smart Voting System will never ask you for your code.</span></td></tr>"
            "<tr><td style=\"padding:4px 0\"><span style=\"font-size:13px;color:" + MUTED + ";line-height:1.6\">&#8226;&nbsp;&nbsp;If you did not request this code, you can safely ignore this email.</span></td></tr>"
            "</table>"
            "</td></tr></table>"
            "</td></tr>"
            # spacer before footer
            + '<tr><td style="background-color:' + CARD_BG + ';height:36px"></td></tr>'
            # closing
            + '<tr><td style="background-color:' + CARD_BG + ';padding:0 40px 32px;text-align:center">'
            '<p style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:' + MUTED + ';margin:0;line-height:1.6">'
            "Thank you,<br><strong style=\"color:" + TEXT_DARK + "\">Smart Voting System</strong>"
            "</p>"
            "</td></tr>"
            + _footer_row(),
            preheader=f"Your Smart Voting System code is {otp}. It expires in {expires_in_minutes} minutes.",
        )
    )
    return subject, plain_body, body


# ══════════════════════════════════════════════════════════════
#  ELECTION RESULT EMAIL
# ══════════════════════════════════════════════════════════════

def build_election_result_email(
    voter_name: str,
    election_name: str,
    constituency: str,
    *,
    is_tie: bool = False,
    tied_candidates: list | None = None,
    winner_name: str = "",
    winner_party: str = "",
    winner_votes: int = 0,
    nota_votes: int = 0,
    nota_exists: bool = False,
) -> tuple:
    """Return (subject, html_body) for an election result email.

    Parameters
    ----------
    voter_name : str
    election_name : str
    constituency : str
    is_tie : bool
    tied_candidates : list[dict] | None  — each dict has keys: name, party, votes
    winner_name, winner_party, winner_votes : str / int
    nota_votes : int
    nota_exists : bool
    """

    subject = f"Election Result: {election_name}"

    voter_escaped = escape(voter_name)
    election_escaped = escape(election_name)
    constituency_escaped = escape(constituency)

    # ── Winner / draw section ──
    if is_tie:
        tied = tied_candidates or []
        tied_names_html = "<br>".join(
            f"<strong>{escape(c['name'])}</strong> <span style=\"color:{MUTED}\">({escape(c['party'])})</span> — {c['votes']} vote{'s' if c['votes'] != 1 else ''}"
            for c in tied
        )
        winner_card = (
            '<tr><td style="padding:0">'
            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">'
            f'<tr><td style="background:linear-gradient(135deg,#FFF7ED,#FFFBEB);border:1.5px solid #F59E0B33;border-radius:14px;padding:24px 28px;text-align:center">'
            '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#D97706;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">&#129309; &nbsp;Draw</div>'
            f'<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:{TEXT_DARK};line-height:1.7">{tied_names_html}</div>'
            '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:' + MUTED + ';margin-top:8px">Each candidate received the same number of votes.</div>'
            "</td></tr></table>"
            "</td></tr>"
        )
    elif winner_name:
        winner_card = (
            '<tr><td style="padding:0">'
            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">'
            f'<tr><td style="background:linear-gradient(135deg,#F0FDF4,#ECFDF5);border:1.5px solid {ACCENT}33;border-radius:14px;padding:24px 28px;text-align:center">'
            '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">&#127942; &nbsp;Winner</div>'
            f'<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:{TEXT_DARK};margin-bottom:4px">{escape(winner_name)}</div>'
            f'<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:{MUTED};margin-bottom:8px">{escape(winner_party)}</div>'
            f'<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:26px;font-weight:800;color:{ACCENT}">{winner_votes} <span style="font-size:13px;font-weight:400;color:{MUTED}">Vote{"s" if winner_votes != 1 else ""}</span></div>'
            "</td></tr></table>"
            "</td></tr>"
        )
    else:
        winner_card = (
            '<tr><td style="padding:0">'
            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">'
            f'<tr><td style="background-color:#F8FAFC;border:1px solid {BORDER};border-radius:14px;padding:24px 28px;text-align:center">'
            '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:' + MUTED + '">No votes were recorded for this constituency.</div>'
            "</td></tr></table>"
            "</td></tr>"
        )

    # ── NOTA row (optional) ──
    nota_row = ""
    if nota_exists:
        nota_row = (
            '<tr><td style="padding:0">'
            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">'
            f'<tr><td style="background-color:#FEF2F2;border:1.5px solid {RED}33;border-radius:14px;padding:20px 28px;text-align:center">'
            '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">&#10060; &nbsp;None of the Above (NOTA)</div>'
            f'<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;color:{RED}">{nota_votes} <span style="font-size:12px;font-weight:400;color:{MUTED}">Vote{"s" if nota_votes != 1 else ""}</span></div>'
            "</td></tr></table>"
            "</td></tr>"
        )

    body = (
        _email_wrapper(
            _header_row()
            + _spacer(0)
            # white card open
            + '<tr><td style="background-color:' + CARD_BG + ';padding:40px 40px 0">'
            # icon
            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="72" style="margin:0 auto">'
            "<tr><td style=\"background:linear-gradient(135deg," + ACCENT + ",#059669);width:72px;height:72px;border-radius:50%;text-align:center\">"
            '<span style="font-size:32px;line-height:72px;display:block">&#128737;&#65039;</span>'
            "</td></tr></table>"
            # heading
            '<h1 style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:' + TEXT_DARK + ';text-align:center;margin:24px 0 6px">Election Concluded</h1>'
            '<p style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:' + MUTED + ';text-align:center;margin:0 0 28px;line-height:1.6">'
            f"Dear <strong>{voter_escaped}</strong>, the election has officially concluded."
            "</p>"
            "</td></tr>"
            # election + constituency info
            + '<tr><td style="background-color:' + CARD_BG + ';padding:0 40px">'
            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">'
            "<tr>"
            '<td width="50%" style="padding:0 6px 0 0;vertical-align:top">'
            f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="background-color:#F8FAFC;border:1px solid {BORDER};border-radius:12px;padding:16px 20px;text-align:center">'
            '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;color:' + MUTED + ';text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Election</div>'
            f'<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:{TEXT_DARK}">{election_escaped}</div>'
            "</td></tr></table>"
            "</td>"
            '<td width="50%" style="padding:0 0 0 6px;vertical-align:top">'
            f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="background-color:#F8FAFC;border:1px solid {BORDER};border-radius:12px;padding:16px 20px;text-align:center">'
            '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;color:' + MUTED + ';text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Constituency</div>'
            f'<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:{TEXT_DARK}">{constituency_escaped}</div>'
            "</td></tr></table>"
            "</td>"
            "</tr></table>"
            "</td></tr>"
            # spacer
            + _spacer(24)
            # winner card
            + '<tr><td style="background-color:' + CARD_BG + ';padding:0 40px">'
            + winner_card
            + "</td></tr>"
            # NOTA row
            + ('<tr><td style="background-color:' + CARD_BG + ';padding:16px 40px 0">' + nota_row + '</td></tr>' if nota_row else "")
            # divider + thank you
            + '<tr><td style="background-color:' + CARD_BG + ';padding:28px 40px 0"><hr style="border:none;border-top:1px solid ' + BORDER + ';margin:0"></td></tr>'
            + '<tr><td style="background-color:' + CARD_BG + ';padding:20px 40px 0;text-align:center">'
            '<p style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:' + MUTED + ';line-height:1.7;margin:0">'
            "Thank you for participating in the Smart Voting System.<br>"
            "Your participation helps strengthen <strong style=\"color:" + TEXT_DARK + "\">transparent digital democracy</strong>."
            "</p>"
            "</td></tr>"
            # CTA
            + '<tr><td style="background-color:' + CARD_BG + ';padding:24px 40px 0;text-align:center">'
            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">'
            "<tr><td style=\"background:linear-gradient(135deg," + PRIMARY + "," + SECONDARY + ");border-radius:10px;padding:14px 40px\">"
            '<a href="http://localhost:3000/results" target="_blank" style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.5px;display:inline-block">'
            "&#128202; &nbsp;View Results"
            "</a>"
            "</td></tr></table>"
            "</td></tr>"
            # spacer
            + '<tr><td style="background-color:' + CARD_BG + ';height:20px"></td></tr>'
            # signature
            + '<tr><td style="background-color:' + CARD_BG + ';padding:0 40px 32px;text-align:center">'
            '<p style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:' + MUTED + ';margin:0;line-height:1.6">'
            "Warm regards,<br><strong style=\"color:" + TEXT_DARK + "\">Smart Voting System</strong>"
            "</p>"
            "</td></tr>"
            + _footer_row()
        )
    )
    return subject, body


# ── Quick standalone test ─────────────────────────────────────
if __name__ == "__main__":
    import pathlib

    out = pathlib.Path(__file__).parent / "_test_emails"
    out.mkdir(exist_ok=True)

    # OTP
    s, plain, h = build_otp_email("847291")
    (out / "otp.html").write_text(h, encoding="utf-8")
    (out / "otp.txt").write_text(plain, encoding="utf-8")

    # Result — single winner
    s2, h2 = build_election_result_email(
        "Raghavendra Patne",
        "2027",
        "Pune",
        winner_name="fjf",
        winner_party="fnnnv",
        winner_votes=1,
        nota_exists=True,
        nota_votes=3,
    )
    (out / "result_winner.html").write_text(h2, encoding="utf-8")

    # Result — tie
    s3, h3 = build_election_result_email(
        "Raghavendra Patne",
        "2027",
        "Pune",
        is_tie=True,
        tied_candidates=[
            {"name": "Alice", "party": "Party A", "votes": 5},
            {"name": "Bob", "party": "Party B", "votes": 5},
        ],
        nota_exists=True,
        nota_votes=2,
    )
    (out / "result_tie.html").write_text(h3, encoding="utf-8")

    print(f"Written to {out}/")
    print("  otp.html")
    print("  result_winner.html")
    print("  result_tie.html")
