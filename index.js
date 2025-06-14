import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import nodemailer from 'nodemailer'

const formatCoin = (data) => `${data.name}: ${data.bid} (alta: ${data.high} / baixa: ${data.low})`

export async function handler () {
  const ssmClient = new SSMClient()

  const ssmResponse = await ssmClient.send(new GetParameterCommand({
    Name: '/smtp/gmail/pass-token',
    WithDecryption: true
  }))
  if (!ssmResponse.Parameter?.Value) {
    throw new Error('Parameter /smtp/gmail/pass-token not found')
  }

  const smtpToken = ssmResponse.Parameter.Value
  const coins = process.env.COINS || 'BTC-USD,USD-BRL,USD-JPY,BRL-JPY,JPY-BRL'

  let result
  try {
    const response = await fetch(`https://economia.awesomeapi.com.br/last/${coins}`)
    const resJson = await response.json()
    result = Object.values(resJson)
  } catch (err) {
    throw new Error(err)
  }

  if (process.env.DRY_RUN === 'true') {
    const consoleContent = result.map(data => `- ${formatCoin(data)}`).join('\n')
    console.log(consoleContent)
    return
  }

  const textContent = result.map(data => `- ${formatCoin(data)}`).join('. ')
  const htmlContent = '<ul>' + result.map(data => `<li>${formatCoin(data)}</li>`).join('') + '</ul>'

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: smtpToken
    }
  })

  try {
    await transporter.sendMail({
      from: `"My automation bot" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USERNAME}>`,
      to: process.env.SMTP_TO_EMAIL,
      subject: 'Currency daily report',
      text: textContent,
      html: htmlContent
    })

    console.log('Message sent with success')
  } catch (error) {
    throw new Error(error)
  }
}
