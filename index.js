import nodemailer from 'nodemailer'

async function sendMail (text, html) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD
    }
  })

  try {
    await transporter.sendMail({
      from: `"My automation bot" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USERNAME}>`,
      to: process.env.SMTP_TO_EMAIL,
      subject: 'Currency daily report',
      text,
      html
    })

    console.log('Message sent with success')
  } catch (error) {
    console.log(error)
  }
}

const coins = process.env.COINS || 'BTC-USD,USD-BRL,USD-JPY,BRL-JPY,JPY-BRL'

let result
try {
  const response = await fetch(`https://economia.awesomeapi.com.br/last/${coins}`)
  const resJson = await response.json()
  result = Object.values(resJson)
} catch (err) {
  console.log(err)
  process.exit(1)
}

const formatCoin = (data) => `${data.name}: ${data.bid} (alta: ${data.high} / baixa: ${data.low})`

if (process.env.DRY_RUN === 'true') {
  const consoleContent = result.map(data => `- ${formatCoin(data)}`).join('\n')

  console.log(consoleContent)
} else {
  const textContent = result.map(data => `- ${formatCoin(data)}`).join('. ')
  const htmlContent = '<ul>' + result.map(data => `<li>${formatCoin(data)}</li>`).join('') + '</ul>'

  await sendMail(textContent, htmlContent)
}
