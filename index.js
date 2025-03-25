// Import required packages
const { Telegraf } = require('telegraf');
const { message, anyOf} = require('telegraf/filters');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const LOGSEQ_PATH = process.env.LOGSEQ_PATH || './';
const ASSETS_PATH = path.join(LOGSEQ_PATH, 'assets');

if (!fs.existsSync(ASSETS_PATH)) {
    fs.mkdirSync(ASSETS_PATH, { recursive: true });
    console.log(`Created assets directory at ${ASSETS_PATH}`);
}

bot.use(async (ctx, next) => {
    console.time(`Processing update ${ctx.update.update_id}`);

    if (ctx.message?.text) {
        console.log(`Received message from ${ctx.from?.username || ctx.from?.id || 'unknown'}: ${ctx.message.text}`);
    } else if (ctx.message) {
        // Check if updateSubTypes exists and has elements
        const updateType = ctx.updateSubTypes && ctx.updateSubTypes.length > 0
            ? ctx.updateSubTypes[0]
            : 'unknown type';

        console.log(`Received ${updateType} from ${ctx.from?.username || ctx.from?.id || 'unknown'}`);
    }

    await next();
    console.timeEnd(`Processing update ${ctx.update.update_id}`);
});

bot.start((ctx) => ctx.reply('Welcome to LSQ Note Saver! Send me any text or media and I will save it to your Logseq journal.'));

bot.on(message('text'), async (ctx) => {
    debugger;

    if (ctx.message.text.startsWith('/')) {
        return;
    }

    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const text = `[${timestamp}] ${ctx.message.text}`;


    let command = `lsq -a "${text}"`;

    try {
        await ctx.replyWithChatAction('typing');

        exec(command, (error, stdout, stderr) => {
            if (error) {
                return ctx.reply(`Error saving note: ${error.message}`);
            }

            if (stderr) {
                return ctx.reply(`Note saved with warnings:\n${stderr}`);
            }

        });
    } catch (e) {
        return ctx.reply(`Failed to save note: ${e.message}`);
    }
});

bot.on(message('photo'), async (ctx) => {
    debugger;
    try {
        await ctx.replyWithChatAction('typing');

        const photoSize = ctx.message.photo[ctx.message.photo.length - 1];
        const fileId = photoSize.file_id;

        const fileInfo = await ctx.telegram.getFile(fileId);

        console.log('File info:', fileInfo);

        if (!fileInfo || !fileInfo.file_path) {
            throw new Error('Could not get file path from Telegram');
        }

        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;

        const fileExtension = path.extname(fileInfo.file_path) || '.jpg';
        const fileHash = crypto.createHash('sha256')
            .update(fileUrl + Date.now())
            .digest('hex')
            .substring(0, 16); // Use a shorter hash for filename
        const fileName = `telegram_photo_${fileHash}${fileExtension}`;
        const filePath = path.join(ASSETS_PATH, fileName);

        console.log(`Downloading photo to ${filePath}`);

        const response = await axios({
            method: 'GET',
            url: fileUrl,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const now = new Date();
        const timestamp = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const caption = ctx.message.caption ? ` ${ctx.message.caption}` : '';
        const mediaNote = `[${timestamp}] 📷 Image${caption}\n![${fileName}](../assets/${fileName})`;

        exec(`lsq -a "${mediaNote}"`, (error, stdout, stderr) => {
            if (error) {
                return ctx.reply(`Error saving image reference: ${error.message}`);
            }

            if (stderr) {
                return ctx.reply(`Image saved with warnings:\n${stderr}`);
            }

        });

    } catch (e) {
        console.error('Error handling photo:', e);
        return ctx.reply(`Failed to save image: ${e.message}`);
    }
});

bot.on(message('video'), async (ctx) => {
    debugger;

    try {
        await ctx.replyWithChatAction('upload_document');

        const fileId = ctx.message.video.file_id;

        const fileInfo = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;

        const fileExtension = path.extname(fileInfo.file_path) || '.mp4';
        const fileHash = crypto.createHash('sha256')
            .update(fileUrl + Date.now())
            .digest('hex');
        const fileName = `${fileHash}${fileExtension}`;
        const filePath = path.join(ASSETS_PATH, fileName);

        const response = await axios({
            method: 'GET',
            url: fileUrl,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const now = new Date();
        const timestamp = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const caption = ctx.message.caption ? ` ${ctx.message.caption}` : '';
        const mediaNote = `[${timestamp}] 🎬 Video${caption}\n![${fileName}](../assets/${fileName})`;

        exec(`lsq -a "${mediaNote}"`, (error, stdout, stderr) => {
            if (error) {
                return ctx.reply(`Error saving video reference: ${error.message}`);
            }

            if (stderr) {
                return ctx.reply(`Video saved with warnings:\n${stderr}`);
            }

        });

    } catch (e) {
        console.error('Error handling video:', e);
        return ctx.reply(`Failed to save video: ${e.message}`);
    }
});

bot.on(message('document'), async (ctx) => {
    debugger;

    try {
        await ctx.replyWithChatAction('upload_document');

        const fileId = ctx.message.document.file_id;

        const fileInfo = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;

        let fileName = ctx.message.document.file_name;

        if (!fileName) {
            const fileExtension = path.extname(fileInfo.file_path) || '.file';
            const fileHash = crypto.createHash('sha256')
                .update(fileUrl + Date.now())
                .digest('hex');
            fileName = `${fileHash}${fileExtension}`;
        }

        const filePath = path.join(ASSETS_PATH, fileName);

        const response = await axios({
            method: 'GET',
            url: fileUrl,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const now = new Date();
        const timestamp = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const caption = ctx.message.caption ? ` ${ctx.message.caption}` : '';
        const mediaNote = `[${timestamp}] 📄 File: ${fileName}${caption}\n[${fileName}](../assets/${fileName})`;

        exec(`lsq -a "${mediaNote}"`, (error, stdout, stderr) => {
            if (error) {
                return ctx.reply(`Error saving file reference: ${error.message}`);
            }

            if (stderr) {
                return ctx.reply(`File saved with warnings:\n${stderr}`);
            }

        });

    } catch (e) {
        console.error('Error handling document:', e);
        return ctx.reply(`Failed to save file: ${e.message}`);
    }
});

bot.on(message('audio'), async (ctx) => {
    debugger;

    try {
        await ctx.replyWithChatAction('upload_document');

        const fileId = ctx.message.audio.file_id;

        const fileInfo = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;

        let fileName = ctx.message.audio.file_name;
        if (!fileName) {
            if (ctx.message.audio.title) {
                fileName = `${ctx.message.audio.title}.mp3`;
            } else {
                const fileExtension = path.extname(fileInfo.file_path) || '.mp3';
                const fileHash = crypto.createHash('sha256')
                    .update(fileUrl + Date.now())
                    .digest('hex');
                fileName = `${fileHash}${fileExtension}`;
            }
        }

        const filePath = path.join(ASSETS_PATH, fileName);

        const response = await axios({
            method: 'GET',
            url: fileUrl,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const now = new Date();
        const timestamp = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const caption = ctx.message.caption ? ` ${ctx.message.caption}` : '';
        const mediaNote = `[${timestamp}] 🎵 Audio: ${fileName}${caption}\n![${fileName}](../assets/${fileName})`;

        exec(`lsq -a "${mediaNote}"`, (error, stdout, stderr) => {
            if (error) {
                return ctx.reply(`Error saving audio reference: ${error.message}`);
            }

            if (stderr) {
                return ctx.reply(`Audio saved with warnings:\n${stderr}`);
            }

        });

    } catch (e) {
        console.error('Error handling audio:', e);
        return ctx.reply(`Failed to save audio: ${e.message}`);
    }
});

bot.on(message('voice'), async (ctx) => {
    try {
        await ctx.replyWithChatAction('upload_document');

        const fileId = ctx.message.voice.file_id;

        // Get file info
        const fileInfo = await ctx.telegram.getFile(fileId);

        if (!fileInfo || !fileInfo.file_path) {
            throw new Error('Could not get file path from Telegram');
        }

        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;

        const fileHash = crypto.createHash('sha256')
            .update(fileUrl + Date.now())
            .digest('hex')
            .substring(0, 16);

        const tempOggPath = path.join(ASSETS_PATH, `temp_voice_${fileHash}.ogg`);

        const mp3FileName = `voice_${fileHash}.mp3`;
        const mp3FilePath = path.join(ASSETS_PATH, mp3FileName);

        console.log(`Downloading voice message to ${tempOggPath}`);

        const response = await axios({
            method: 'GET',
            url: fileUrl,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(tempOggPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        console.log('Voice message downloaded, converting to MP3...');

        await new Promise((resolve, reject) => {
            exec(`ffmpeg -i ${tempOggPath} -codec:a libmp3lame -qscale:a 2 ${mp3FilePath}`, (error, stdout, stderr) => {
                if (error) {
                    console.error('Error converting to MP3:', error);
                    reject(error);
                    return;
                }

                // Remove the temporary ogg file after conversion
                fs.unlink(tempOggPath, (err) => {
                    if (err) console.error('Failed to remove temp file:', err);
                });

                resolve();
            });
        });

        const now = new Date();
        const timestamp = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const duration = ctx.message.voice.duration ? ` (${ctx.message.voice.duration}s)` : '';
        const caption = ctx.message.caption ? ` ${ctx.message.caption}` : '';
        const mediaNote = `[${timestamp}] 🎤 Voice message${duration}${caption}\n![${mp3FileName}](../assets/${mp3FileName})`;

        exec(`lsq -a "${mediaNote}"`, (error, stdout, stderr) => {
            if (error) {
                return ctx.reply(`Error saving voice message reference: ${error.message}`);
            }

            if (stderr) {
                return ctx.reply(`Voice message saved with warnings:\n${stderr}`);
            }

        });

    } catch (e) {
        console.error('Error handling voice message:', e);
        return ctx.reply(`Failed to save voice message: ${e.message}`);
    }
});

bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}`, err);
    ctx.reply('An error occurred while processing your message. Please try again.');
});

bot.launch()
    .then(() => {
        console.log('LSQ Note Saver Bot started successfully!');
        console.log(`Media files will be saved to: ${ASSETS_PATH}`);
    })
    .catch((err) => {
        console.error('Failed to start bot:', err);
    });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
