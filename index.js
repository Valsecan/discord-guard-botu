console.log("Bot başlatılıyor...");
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.GuildMember]
});

const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

let backupChannels = {};
let backupRoles = {};

client.once(Events.ClientReady, async () => {
  const guild = await client.guilds.fetch(GUILD_ID);
  client.logChannel = await guild.channels.fetch(LOG_CHANNEL_ID);

  // Kanalları yedekle
  const channels = await guild.channels.fetch();
  channels.forEach(ch => {
    backupChannels[ch.id] = {
      name: ch.name,
      type: ch.type,
      parentId: ch.parentId,
      permissionOverwrites: ch.permissionOverwrites.cache.map(p => ({
        id: p.id,
        allow: p.allow.bitfield,
        deny: p.deny.bitfield
      }))
    };
  });

  // Rolleri yedekle
  const roles = await guild.roles.fetch();
  roles.forEach(r => {
    backupRoles[r.id] = {
      name: r.name,
      color: r.color,
      permissions: r.permissions.bitfield,
      hoist: r.hoist,
      mentionable: r.mentionable
    };
  });

  if (client.logChannel) client.logChannel.send('Guard sistemi hazır ve yedekler alındı.');
});

// Kanal silme
client.on(Events.ChannelDelete, async channel => {
  const guild = channel.guild;
  const audit = await guild.fetchAuditLogs({ type: 12, limit: 1 });
  const executor = audit.entries.first()?.executor;

  // Silen kişinin rollerini al
  if (executor) {
    const member = guild.members.cache.get(executor.id);
    if (member && member.roles.cache.size > 0) await member.roles.set([]);
  }

  // Kanalı geri oluştur
  const data = backupChannels[channel.id];
  if (data) {
    await guild.channels.create({
      name: data.name,
      type: data.type,
      parent: data.parentId,
      permissionOverwrites: data.permissionOverwrites.map(p => ({
        id: p.id,
        allow: BigInt(p.allow),
        deny: BigInt(p.deny)
      }))
    });
    if (client.logChannel) client.logChannel.send(`🟢 Kanal geri oluşturuldu: ${data.name}`);
  }
});

// Kanal açma
client.on(Events.ChannelCreate, async channel => {
  const guild = channel.guild;
  const audit = await guild.fetchAuditLogs({ type: 10, limit: 1 });
  const executor = audit.entries.first()?.executor;

  if (executor) {
    const member = guild.members.cache.get(executor.id);
    if (member && member.roles.cache.size > 0) await member.roles.set([]);
  }
});

// Rol silme
client.on(Events.RoleDelete, async role => {
  const guild = role.guild;
  const audit = await guild.fetchAuditLogs({ type: 32, limit: 1 });
  const executor = audit.entries.first()?.executor;

  if (executor) {
    const member = guild.members.cache.get(executor.id);
    if (member && member.roles.cache.size > 0) await member.roles.set([]);
  }

  const data = backupRoles[role.id];
  if (data) {
    await guild.roles.create({
      name: data.name,
      color: data.color,
      permissions: data.permissions,
      hoist: data.hoist,
      mentionable: data.mentionable
    });
    if (client.logChannel) client.logChannel.send(`🟢 Rol geri oluşturuldu: ${data.name}`);
  }
});

// Rol oluşturma
client.on(Events.RoleCreate, async role => {
  const guild = role.guild;
  const audit = await guild.fetchAuditLogs({ type: 30, limit: 1 });
  const executor = audit.entries.first()?.executor;

  if (executor) {
    const member = guild.members.cache.get(executor.id);
    if (member && member.roles.cache.size > 0) await member.roles.set([]);
  }
});

// Kick/ban guard
client.on(Events.GuildMemberRemove, async member => {
  const guild = member.guild;
  const audit = await guild.fetchAuditLogs({ type: 20, limit: 1 }); // Kick
  const executor = audit.entries.first()?.executor;

  if (executor) {
    const execMember = guild.members.cache.get(executor.id);
    if (execMember && execMember.roles.cache.size > 0) await execMember.roles.set([]);
    if (client.logChannel) client.logChannel.send(`⚠️ ${executor.tag} üyenin rollerini kaybetti.`);
  }
});

client.login(process.env.DISCORD_TOKEN);
