import {
    put,
    list,
    del
} from "@vercel/blob";


const BOT_TOKEN =
    process.env.BOT_TOKEN;


const ADMIN_CHAT_ID =
    String(
        process.env.ADMIN_CHAT_ID || ""
    );


const WEBHOOK_SECRET =
    process.env.TELEGRAM_WEBHOOK_SECRET;


const TELEGRAM_API =
    `https://api.telegram.org/bot${BOT_TOKEN}`;


export default async function handler(
    req,
    res
) {

    if (req.method !== "POST") {

        return res
            .status(405)
            .json({
                ok: false,
                error: "Method not allowed"
            });
    }


    // حماية الـWebhook
    const receivedSecret =
        req.headers[
            "x-telegram-bot-api-secret-token"
        ];


    if (
        !WEBHOOK_SECRET ||
        receivedSecret !== WEBHOOK_SECRET
    ) {

        return res
            .status(401)
            .json({
                ok: false,
                error: "Unauthorized"
            });
    }


    try {

        const update =
            req.body;


        if (update.callback_query) {

            await handleCallback(
                update.callback_query
            );

        } else if (update.message) {

            await handleMessage(
                update.message
            );
        }


        return res
            .status(200)
            .json({
                ok: true
            });


    } catch (error) {

        console.error(
            "Telegram webhook error:",
            error
        );


        return res
            .status(500)
            .json({
                ok: false,
                error:
                    "Internal server error"
            });
    }
}


/* =========================
   MESSAGE
========================= */

async function handleMessage(message) {

    if (
        String(message.chat.id) !==
        ADMIN_CHAT_ID
    ) {

        return;
    }


    // /start
    if (
        message.text === "/start" ||
        message.text === "/menu"
    ) {

        await sendMessage(
            message.chat.id,

            "🤖 <b>لوحة تحكم RH_FileBox</b>\n\n" +
            "اختار العملية:",

            mainKeyboard()
        );

        return;
    }


    // ملف
    if (message.document) {

        await addTelegramFile(
            message
        );

        return;
    }
}


/* =========================
   ADD FILE
========================= */

async function addTelegramFile(
    message
) {

    const document =
        message.document;


    await sendMessage(
        message.chat.id,

        "⏳ جاري رفع الملف للموقع..."
    );


    try {

        const telegramFile =
            await telegramRequest(
                "getFile",
                {
                    file_id:
                        document.file_id
                }
            );


        const telegramFilePath =
            telegramFile.result.file_path;


        const downloadUrl =
            `https://api.telegram.org/file/bot` +
            `${BOT_TOKEN}/` +
            `${telegramFilePath}`;


        const response =
            await fetch(
                downloadUrl
            );


        if (!response.ok) {

            throw new Error(
                "فشل تحميل الملف من Telegram"
            );
        }


        const buffer =
            await response.arrayBuffer();


        const key =
            makeKey();


        const originalName =
            document.file_name ||
            "file";


        /*
          الاسم داخل pathname:

          filebox/
          key
          __
          encoded filename
        */

        const pathname =
            `filebox/${key}__` +
            encodeURIComponent(
                originalName
            );


        const blob =
            await put(
                pathname,
                buffer,
                {
                    access: "public",

                    contentType:
                        document.mime_type ||
                        "application/octet-stream",

                    addRandomSuffix:
                        false
                }
            );


        await sendMessage(

            message.chat.id,

            `✅ <b>تمت إضافة الملف</b>\n\n` +
            `📄 ${escapeHtml(originalName)}\n` +
            `📦 ${formatSize(document.file_size || 0)}`,

            mainKeyboard()
        );


    } catch (error) {

        console.error(error);


        await sendMessage(

            message.chat.id,

            "❌ وقع خطأ أثناء رفع الملف.\n\n" +
            escapeHtml(
                error.message
            ),

            mainKeyboard()
        );
    }
}


/* =========================
   CALLBACK BUTTONS
========================= */

async function handleCallback(
    query
) {

    const chatId =
        query.message?.chat?.id;


    if (
        String(chatId) !==
        ADMIN_CHAT_ID
    ) {

        await answerCallback(
            query.id,
            "غير مصرح."
        );

        return;
    }


    await answerCallback(
        query.id
    );


    const data =
        query.data || "";


    /* إضافة ملف */

    if (
        data === "add_file"
    ) {

        await editMessage(

            query.message,

            "📤 <b>إضافة ملف</b>\n\n" +
            "صيفط دابا الملف للبوت " +
            "وغادي يتحط مباشرة فالموقع.",

            backKeyboard()
        );

        return;
    }


    /* ملفات الموقع */

    if (
        data === "list_files"
    ) {

        await showFiles(
            query.message
        );

        return;
    }


    /* الإحصائيات */

    if (
        data === "stats"
    ) {

        const files =
            await getBlobFiles();


        const totalSize =
            files.reduce(
                (sum, file) =>
                    sum +
                    Number(
                        file.size || 0
                    ),
                0
            );


        await editMessage(

            query.message,

            `📊 <b>الإحصائيات</b>\n\n` +
            `📁 عدد الملفات: ${files.length}\n` +
            `📦 الحجم الإجمالي: ${formatSize(totalSize)}`,

            backKeyboard()
        );

        return;
    }


    /* رجوع */

    if (
        data === "back"
    ) {

        await editMessage(

            query.message,

            "🤖 <b>لوحة تحكم RH_FileBox</b>\n\n" +
            "اختار العملية:",

            mainKeyboard()
        );

        return;
    }


    /* تأكيد الحذف */

    if (
        data.startsWith(
            "confirm:"
        )
    ) {

        const key =
            data.substring(
                "confirm:".length
            );


        const file =
            await findFileByKey(
                key
            );


        if (!file) {

            await editMessage(
                query.message,

                "⚠️ الملف غير موجود.",

                listKeyboard()
            );

            return;
        }


        await editMessage(

            query.message,

            `⚠️ <b>تأكيد الحذف</b>\n\n` +
            `📄 ${escapeHtml(file.name)}\n\n` +
            `واش متأكد؟`,

            {
                inline_keyboard: [

                    [
                        {
                            text:
                                "✅ نعم، حذف",

                            callback_data:
                                `delete:${file.key}`
                        }
                    ],

                    [
                        {
                            text:
                                "❌ إلغاء",

                            callback_data:
                                "list_files"
                        }
                    ]

                ]
            }
        );

        return;
    }


    /* حذف */

    if (
        data.startsWith(
            "delete:"
        )
    ) {

        const key =
            data.substring(
                "delete:".length
            );


        const file =
            await findFileByKey(
                key
            );


        if (!file) {

            await editMessage(

                query.message,

                "⚠️ الملف غير موجود.",

                listKeyboard()
            );

            return;
        }


        await del(
            file.url
        );


        await editMessage(

            query.message,

            `🗑️ <b>تم حذف الملف</b>\n\n` +
            `📄 ${escapeHtml(file.name)}`,

            listKeyboard()
        );

        return;
    }
}


/* =========================
   LIST FILES
========================= */

async function showFiles(
    message
) {

    const files =
        await getBlobFiles();


    if (!files.length) {

        await editMessage(

            message,

            "📂 <b>ملفات الموقع</b>\n\n" +
            "لا توجد ملفات حالياً.",

            backKeyboard()
        );

        return;
    }


    const buttons =
        files.map(
            file => [

                {
                    text:
                        `🗑️ ${shortName(file.name)}`,

                    callback_data:
                        `confirm:${file.key}`
                }

            ]
        );


    buttons.push([
        {
            text:
                "🔄 تحديث",

            callback_data:
                "list_files"
        }
    ]);


    buttons.push([
        {
            text:
                "⬅️ رجوع",

            callback_data:
                "back"
        }
    ]);


    await editMessage(

        message,

        `📂 <b>ملفات الموقع</b>\n\n` +
        `عدد الملفات: ${files.length}\n\n` +
        `اضغط على الملف لحذفه.`,

        {
            inline_keyboard:
                buttons
        }
    );
}


/* =========================
   GET BLOBS
========================= */

async function getBlobFiles() {

    let blobs = [];

    let cursor =
        undefined;


    do {

        const result =
            await list({

                prefix:
                    "filebox/",

                limit:
                    1000,

                cursor
            });


        blobs =
            blobs.concat(
                result.blobs
            );


        cursor =
            result.hasMore
                ? result.cursor
                : undefined;

    } while (cursor);


    return blobs.map(
        blob => {

            const filename =
                blob.pathname
                    .split("/")
                    .pop();


            const parts =
                filename.split(
                    "__"
                );


            const key =
                parts[0];


            let name =
                parts
                    .slice(1)
                    .join("__");


            try {

                name =
                    decodeURIComponent(
                        name
                    );

            } catch {
                // keep original
            }


            return {

                key,

                name:
                    name ||
                    filename,

                size:
                    blob.size,

                url:
                    blob.url,

                downloadUrl:
                    blob.downloadUrl,

                addedAt:
                    blob.uploadedAt
            };
        }
    );
}


/* =========================
   FIND FILE
========================= */

async function findFileByKey(
    key
) {

    const files =
        await getBlobFiles();


    return (
        files.find(
            file =>
                file.key === key
        ) ||
        null
    );
}


/* =========================
   TELEGRAM API
========================= */

async function telegramRequest(
    method,
    body = {}
) {

    const response =
        await fetch(
            `${TELEGRAM_API}/${method}`,
            {
                method:
                    "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        body
                    )
            }
        );


    const result =
        await response.json();


    if (!result.ok) {

        throw new Error(
            result.description ||
            "Telegram API error"
        );
    }


    return result;
}


/* =========================
   SEND MESSAGE
========================= */

async function sendMessage(
    chatId,
    text,
    keyboard = undefined
) {

    const body = {

        chat_id:
            chatId,

        text,

        parse_mode:
            "HTML"
    };


    if (keyboard) {

        body.reply_markup =
            keyboard;
    }


    return telegramRequest(
        "sendMessage",
        body
    );
}


/* =========================
   EDIT MESSAGE
========================= */

async function editMessage(
    message,
    text,
    keyboard
) {

    return telegramRequest(

        "editMessageText",

        {

            chat_id:
                message.chat.id,

            message_id:
                message.message_id,

            text,

            parse_mode:
                "HTML",

            reply_markup:
                keyboard
        }
    );
}


/* =========================
   ANSWER CALLBACK
========================= */

async function answerCallback(
    id,
    text = ""
) {

    return telegramRequest(

        "answerCallbackQuery",

        {

            callback_query_id:
                id,

            text
        }
    );
}


/* =========================
   KEYBOARDS
========================= */

function mainKeyboard() {

    return {

        inline_keyboard: [

            [
                {
                    text:
                        "📤 إضافة ملف",

                    callback_data:
                        "add_file"
                }
            ],

            [
                {
                    text:
                        "📂 ملفات الموقع",

                    callback_data:
                        "list_files"
                }
            ],

            [
                {
                    text:
                        "📊 الإحصائيات",

                    callback_data:
                        "stats"
                }
            ]

        ]
    };
}


function backKeyboard() {

    return {

        inline_keyboard: [

            [
                {
                    text:
                        "⬅️ رجوع",

                    callback_data:
                        "back"
                }
            ]

        ]
    };
}


function listKeyboard() {

    return {

        inline_keyboard: [

            [
                {
                    text:
                        "📂 ملفات الموقع",

                    callback_data:
                        "list_files"
                }
            ],

            [
                {
                    text:
                        "⬅️ رجوع",

                    callback_data:
                        "back"
                }
            ]

        ]
    };
}


/* =========================
   HELPERS
========================= */

function makeKey() {

    return (
        Date.now()
            .toString(36)
        +
        Math.random()
            .toString(36)
            .substring(2, 8)
    );
}


function shortName(name) {

    if (
        name.length <= 25
    ) {

        return name;
    }


    return (
        name.substring(
            0,
            22
        )
        +
        "..."
    );
}


function formatSize(bytes) {

    if (!bytes) {

        return "0 B";
    }


    const units = [
        "B",
        "KB",
        "MB",
        "GB",
        "TB"
    ];


    const index =
        Math.min(
            Math.floor(
                Math.log(bytes) /
                Math.log(1024)
            ),

            units.length - 1
        );


    return (
        (
            bytes /
            Math.pow(
                1024,
                index
            )
        ).toFixed(2)
        +
        " "
        +
        units[index]
    );
}


function escapeHtml(text) {

    return String(text)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        );
}