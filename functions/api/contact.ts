interface Env {
  RESEND_API_KEY?: string
  CONTACT_TO_EMAIL?: string
  CONTACT_FROM_EMAIL?: string
}

interface ContactPayload {
  name?: unknown
  email?: unknown
  company?: unknown
  need?: unknown
  message?: unknown
  link?: unknown
}

const jsonHeaders = { 'content-type': 'application/json; charset=UTF-8' }

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

function readText(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json(415, { error: 'JSON requests only.' })
  }

  let payload: ContactPayload
  try {
    payload = (await request.json()) as ContactPayload
  } catch {
    return json(400, { error: 'Invalid form data.' })
  }

  const name = readText(payload.name, 120)
  const email = readText(payload.email, 254)
  const company = readText(payload.company, 160)
  const need = readText(payload.need, 120)
  const message = readText(payload.message, 5000)
  const link = readText(payload.link, 500)

  if (!name || !need || !message || !/^\S+@\S+\.\S+$/.test(email)) {
    return json(400, { error: 'Please complete the required fields.' })
  }

  if (!env.RESEND_API_KEY || !env.CONTACT_TO_EMAIL || !env.CONTACT_FROM_EMAIL) {
    console.error('Contact email is not configured.')
    return json(503, { error: 'Email delivery is not configured.' })
  }

  const emailBody = [
    'New project enquiry from Figures It Out',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `Company: ${company || 'Not provided'}`,
    `Project type: ${need}`,
    `Project link: ${link || 'Not provided'}`,
    '',
    'Message:',
    message,
  ].join('\n')

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM_EMAIL,
        to: [env.CONTACT_TO_EMAIL],
        reply_to: email,
        subject: `New project enquiry — ${name}`,
        text: emailBody,
      }),
    })

    if (!resendResponse.ok) {
      console.error('Resend rejected the contact email.', resendResponse.status)
      return json(502, { error: 'Email provider rejected the request.' })
    }
  } catch (error) {
    console.error('Contact email delivery failed.', error)
    return json(502, { error: 'Email delivery failed.' })
  }

  return json(200, { ok: true })
}
