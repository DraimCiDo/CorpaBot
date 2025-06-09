import os
import discord
from discord.ext import commands

CREATE_CHANNEL_NAME = "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043a\u0430\u043d\u0430\u043b"  # "Создать канал"
TEMP_CHANNEL_PREFIX = "\u041a\u0430\u043d\u0430\u043b "  # "Канал "

token = os.getenv("DISCORD_TOKEN")
if not token:
    raise RuntimeError("DISCORD_TOKEN environment variable not set")

intents = discord.Intents.default()
intents.voice_states = True
intents.guilds = True

bot = commands.Bot(command_prefix="!", intents=intents)

created_channels = set()


@bot.event
async def on_voice_state_update(
    member: discord.Member, before: discord.VoiceState, after: discord.VoiceState
):
    # Create a temporary voice channel when user joins the create channel
    if after.channel and after.channel.name == CREATE_CHANNEL_NAME:
        category = after.channel.category
        new_channel = await member.guild.create_voice_channel(
            name=f"{TEMP_CHANNEL_PREFIX}{member.display_name}", category=category
        )
        created_channels.add(new_channel.id)
        await member.move_to(new_channel)

    # Delete temporary voice channel if it becomes empty
    if before.channel and before.channel.id in created_channels:
        if len(before.channel.members) == 0:
            created_channels.remove(before.channel.id)
            await before.channel.delete()


bot.run(token)
