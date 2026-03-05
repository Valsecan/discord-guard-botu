const { Client, GatewayIntentBits, Events, AuditLogEvent } = require('discord.js');
const express = require("express");

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration
  ]
});


// Web server (Railway için)
const app = express();
app.get("/", (req,res)=>res.send("Guard Bot Aktif"));
app.listen(8080, ()=>console.log("Web server 8080 portunda açık"));


// READY
client.once(Events.ClientReady, async () => {

  console.log(`Bot açıldı: ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  client.logChannel = await guild.channels.fetch(LOG_CHANNEL_ID);

});


// YETKİLİ CEZALANDIRMA
async function punish(guild, userId){

  const member = guild.members.cache.get(userId);

  if(!member) return;

  try{
    await member.roles.set([]);
  }catch{}
}


// KANAL SİLME
client.on(Events.ChannelDelete, async channel => {

  const audit = await channel.guild.fetchAuditLogs({
    limit:1,
    type:AuditLogEvent.ChannelDelete
  });

  const entry = audit.entries.first();
  if(!entry) return;

  const executor = entry.executor;

  await punish(channel.guild, executor.id);

  client.logChannel.send(`🚨 Kanal silindi | ${executor.tag}`);

});


// KANAL OLUŞTURMA
client.on(Events.ChannelCreate, async channel => {

  const audit = await channel.guild.fetchAuditLogs({
    limit:1,
    type:AuditLogEvent.ChannelCreate
  });

  const entry = audit.entries.first();
  if(!entry) return;

  const executor = entry.executor;

  await punish(channel.guild, executor.id);

  await channel.delete().catch(()=>{});

  client.logChannel.send(`🚨 Kanal açıldı ve silindi | ${executor.tag}`);

});


// ROL SİLME
client.on(Events.RoleDelete, async role => {

  const audit = await role.guild.fetchAuditLogs({
    limit:1,
    type:AuditLogEvent.RoleDelete
  });

  const entry = audit.entries.first();
  if(!entry) return;

  const executor = entry.executor;

  await punish(role.guild, executor.id);

  client.logChannel.send(`🚨 Rol silindi | ${executor.tag}`);

});


// ROL OLUŞTURMA
client.on(Events.RoleCreate, async role => {

  const audit = await role.guild.fetchAuditLogs({
    limit:1,
    type:AuditLogEvent.RoleCreate
  });

  const entry = audit.entries.first();
  if(!entry) return;

  const executor = entry.executor;

  await punish(role.guild, executor.id);

  await role.delete().catch(()=>{});

  client.logChannel.send(`🚨 Rol oluşturuldu ve silindi | ${executor.tag}`);

});


// ROL VERME / ALMA
client.on(Events.GuildMemberUpdate, async (oldMember,newMember)=>{

  if(oldMember.roles.cache.size === newMember.roles.cache.size) return;

  const audit = await newMember.guild.fetchAuditLogs({
    limit:1,
    type:AuditLogEvent.MemberRoleUpdate
  });

  const entry = audit.entries.first();
  if(!entry) return;

  const executor = entry.executor;

  if(executor.id === newMember.id) return;

  await punish(newMember.guild, executor.id);

  client.logChannel.send(`🚨 İzinsiz rol işlemi | ${executor.tag}`);

});


// KICK GUARD
client.on(Events.GuildMemberRemove, async member => {

  const audit = await member.guild.fetchAuditLogs({
    limit:1,
    type:AuditLogEvent.MemberKick
  });

  const entry = audit.entries.first();
  if(!entry) return;

  const executor = entry.executor;

  await punish(member.guild, executor.id);

  client.logChannel.send(`🚨 Kick atıldı | ${executor.tag}`);

});


// BAN GUARD
client.on(Events.GuildBanAdd, async ban => {

  const audit = await ban.guild.fetchAuditLogs({
    limit:1,
    type:AuditLogEvent.MemberBanAdd
  });

  const entry = audit.entries.first();
  if(!entry) return;

  const executor = entry.executor;

  await punish(ban.guild, executor.id);

  client.logChannel.send(`🚨 Ban atıldı | ${executor.tag}`);

});


// BOT EKLEME GUARD
client.on(Events.GuildMemberAdd, async member => {

  if(!member.user.bot) return;

  const audit = await member.guild.fetchAuditLogs({
    limit:1,
    type:AuditLogEvent.BotAdd
  });

  const entry = audit.entries.first();
  if(!entry) return;

  const executor = entry.executor;

  await punish(member.guild, executor.id);

  await member.ban().catch(()=>{});

  client.logChannel.send(`🚨 Bot eklendi ve banlandı | ${executor.tag}`);

});


client.login(TOKEN);
