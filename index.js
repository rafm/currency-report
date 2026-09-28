import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm'

const formatCoin = (data) => `${data.name}: ${data.bid} (alta: ${data.high} / baixa: ${data.low})`

export async function handler() {
  const isDryRun = process.env.DRY_RUN === 'true'
  const discordChannelId = process.env.DISCORD_CHANNEL_ID
  if (!isDryRun && !discordChannelId) {
    throw new Error('Required DISCORD_CHANNEL_ID environment variable not found')
  }

  const ssmClient = new SSMClient()
  const ssmResponse = await ssmClient.send(new GetParametersCommand({
    Names: ['/discord/bot/token', '/awesome-api/token'],
    WithDecryption: true
  }))
  const parameters = Object.fromEntries(
    ssmResponse.Parameters.map(parameter => [parameter.Name, parameter.Value])
  )

  const awesomeApiToken = parameters['/awesome-api/token']
  if (!awesomeApiToken) {
    throw new Error('Parameter /awesome-api/token not found')
  }
  const discordBotToken = parameters['/discord/bot/token']
  if (!isDryRun && !discordBotToken) {
    throw new Error('Parameter /discord/bot/token not found')
  }

  let result
  const coins = process.env.COINS || 'BTC-USD,USD-BRL,USD-JPY,BRL-JPY,JPY-BRL'
  try {
    const response = await fetch(`https://economia.awesomeapi.com.br/last/${coins}`, {
      headers: {
        'x-api-key': awesomeApiToken
      }
    })
    const resJson = await response.json()
    result = Object.values(resJson)
  } catch (err) {
    throw new Error(err)
  }

  const textContent = 'Currency report:\n' + result.map(data => `- ${formatCoin(data)}`).join('\n')
  if (isDryRun) {
    console.log(textContent)
    return
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${discordChannelId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${discordBotToken}`
      },
      body: JSON.stringify({
        content: textContent
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to send message to Discord channel. Status ${response.status}: ${await response.text()}`)
    }

    console.log('Message sent with success')
  } catch (error) {
    throw new Error(error)
  }
}
