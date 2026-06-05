const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js")
const fs = require("fs")
require("dotenv").config()

const config = require("./config.json")

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
})

let threads = {}
let cooldowns = {}

if (fs.existsSync("./threads.json")) {
  threads = JSON.parse(fs.readFileSync("./threads.json"))
}

function saveThreads() {
  fs.writeFileSync("./threads.json", JSON.stringify(threads, null, 2))
}

function isCooldown(id) {
  if (!cooldowns[id]) return false
  return Date.now() - cooldowns[id] < 5000
}

function setCooldown(id) {
  cooldowns[id] = Date.now()
}

function embed(title, desc, color) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setTimestamp()
}

client.on("messageCreate", async message => {
  if (message.author.bot) return

  if (message.channel.type === 1) {
    if (isCooldown(message.author.id)) {
      return message.reply("⏳ slow down")
    }

    setCooldown(message.author.id)

    const channel = await client.channels.fetch(config.modmailChannelId)

    const files = message.attachments.map(a => a.url)

    const sent = await channel.send({
      embeds: [
        embed(
          "ModMail",
          message.content || "*empty*",
          "Blue"
        ).addFields({
          name: "User",
          value: `${message.author.tag} (${message.author.id})`
        })
      ]
    })

    if (files.length) {
      await channel.send(files.join("\n"))
    }

    threads[message.author.id] = {
      messageId: sent.id,
      status: "open"
    }

    saveThreads()

    return message.reply("📨 sent")
  }

  if (message.channel.id !== config.modmailChannelId) return

  const args = message.content.split(" ")
  const cmd = args.shift().toLowerCase()

  if (cmd === "!close") {
    if (!message.reference) return message.reply("reply to ticket")

    const id = message.reference.messageId
    const userId = Object.keys(threads).find(t => threads[t].messageId === id)

    if (!userId) return message.reply("not found")

    const user = await client.users.fetch(userId)

    threads[userId].status = "closed"
    saveThreads()

    await user.send(embed("Closed", "ticket closed", "Red"))

    return message.reply("closed")
  }

  if (cmd === "!reply") {
    if (!message.reference) return message.reply("reply to msg")

    const id = message.reference.messageId
    const userId = Object.keys(threads).find(t => threads[t].messageId === id)

    if (!userId) return message.reply("not found")

    const user = await client.users.fetch(userId)

    const text = args.join(" ") || message.content

    await user.send(embed("Staff Reply", text, "Green"))

    return message.reply("sent")
  }

  if (cmd === "!reopen") {
    if (!message.reference) return message.reply("reply required")

    const id = message.reference.messageId
    const userId = Object.keys(threads).find(t => threads[t].messageId === id)

    if (!userId) return message.reply("not found")

    threads[userId].status = "open"
    saveThreads()

    const user = await client.users.fetch(userId)

    await user.send(embed("Reopened", "ticket reopened", "Green"))

    return message.reply("reopened")
  }
})

client.once("ready", () => {
  console.log(client.user.tag)
})

client.login(process.env.TOKEN)
