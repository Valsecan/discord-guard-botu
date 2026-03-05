const { Client, GatewayIntentBits, Events, AuditLogEvent } = require('discord.js');
const express = require('express');

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

const app = express();
app.get("/", (req,res)=>res.send("Bot çalışıyor"));
app.listen(8080, ()=>console.log("Web server 8080 portunda açık"));

let logChannel;

// READY
client.once(Events.ClientReady, async () => {

  console.log(`Bot açıldı: ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);

  logChannel = await guild.channels.fetch(LOG_CHANNEL_ID);

  console.log("Guard sistemi aktif");

});


// CEZA FONKSİYONU
async function punish(guild, userId, reason){

  const member = await guild.members.fetch(userId).catch(()=>null);

  if(!member) return;

  await member.roles.set([]);

  if(logChannel){
    logChannel.send(`🚨 ${member.user.tag} → ${reason} yaptığı için tüm rolleri alındı`);
  }

}


// KANAL SİLME
client.on(Events.ChannelDelete, async channel => {

  const audit = await channel.guild.fetchAuditLogs({
    type: AuditLogEvent.ChannelDelete,
    limit:1
  });

  const entry = audit.entries.first();
  if(!entry) return;

  punish(channel.guild, entry.executor.id, "kanal silme");

});


// KANAL OLUŞTURMA
client.on(Events.ChannelCreate, async channel => {

  const audit = await channel.guild.fetchAuditLogs({
    type: AuditLogEvent.ChannelCreate,
    limit:1
  });

  const entry = audit.entries.first();
  if(!entry) return;

  punish(channel.guild, entry.executor.id, "kanal oluşturma");

});


// ROL SİLME
client.on(Events.RoleDelete, async role => {

  const audit = await role.guild.fetchAuditLogs({
    type: AuditLogEvent.RoleDelete,
    limit:1
  });

  const entry = audit.entries.first();
  if(!entry) return;

  punish(role.guild, entry.executor.id, "rol silme");

});


// ROL OLUŞTURMA
client.on(Events.RoleCreate, async role => {

  const audit = await role.guild.fetchAuditLogs({
    type: AuditLogEvent.RoleCreate,
    limit:1
  });

  const entry = audit.entries.first();
  if(!entry) return;

  punish(role.guild, entry.executor.id, "rol oluşturma");

});


// ROL VERME
client.on(Events.GuildMemberUpdate, async (oldMember,newMember)=>{

  if(oldMember.roles.cache.size >= newMember.roles.cache.size) return;

  const audit = await newMember.guild.fetchAuditLogs({
    type: AuditLogEvent.MemberRoleUpdate,
    limit:1
  });

  const entry = audit.entries.first();
  if(!entry) return;

  punish(newMember.guild, entry.executor.id, "rol verme");

});


// BAN
client.on(Events.GuildBanAdd, async ban => {

  const audit = await ban.guild.fetchAuditLogs({
    type: AuditLogEvent.MemberBanAdd,
    limit:1
  });

  const entry = audit.entries.first();
  if(!entry) return;

  punish(ban.guild, entry.executor.id, "ban atma");

});


// KICK
client.on(Events.GuildMemberRemove, async member => {

  const audit = await member.guild.fetchAuditLogs({
    type: AuditLogEvent.MemberKick,
    limit:1
  });

  const entry = audit.entries.first();
  if(!entry) return;

  punish(member.guild, entry.executor.id, "kick atma");

});


client.login(TOKEN);
