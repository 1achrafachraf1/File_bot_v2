let files = [];


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        document.getElementById(
            "siteName"
        ).textContent =
            CONFIG.SITE_NAME;


        document.getElementById(
            "footerName"
        ).textContent =
            CONFIG.SITE_NAME;


        document.getElementById(
            "searchInput"
        ).addEventListener(
            "input",
            renderFiles
        );


        document.getElementById(
            "refreshBtn"
        ).addEventListener(
            "click",
            loadFiles
        );


        await loadFiles();


        setInterval(
            loadFiles,
            CONFIG.REFRESH_INTERVAL
        );

    }
);


async function loadFiles() {

    try {

        setStatus(
            "loading",
            "جاري التحديث..."
        );


        const response =
            await fetch(
                "/api/files",
                {
                    cache: "no-store"
                }
            );


        const data =
            await response.json();


        if (!response.ok || !data.ok) {

            throw new Error(
                data.error ||
                "API Error"
            );
        }


        files =
            Array.isArray(data.files)
                ? data.files
                : [];


        renderFiles();


        setStatus(
            "online",
            "متصل"
        );


    } catch (error) {

        console.error(error);


        setStatus(
            "error",
            "تعذر الاتصال"
        );


        showNotice(
            "تعذر تحميل الملفات."
        );

    }
}


function renderFiles() {

    const container =
        document.getElementById(
            "filesContainer"
        );


    const empty =
        document.getElementById(
            "empty"
        );


    const loading =
        document.getElementById(
            "loading"
        );


    const search =
        document.getElementById(
            "searchInput"
        );


    const query =
        search.value
            .toLowerCase()
            .trim();


    loading.classList.add(
        "hidden"
    );


    container.innerHTML = "";


    const filtered =
        files.filter(
            file =>
                String(
                    file.name || ""
                )
                .toLowerCase()
                .includes(query)
        );


    if (!filtered.length) {

        empty.classList.remove(
            "hidden"
        );

        return;
    }


    empty.classList.add(
        "hidden"
    );


    filtered.forEach(
        file => {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "fileCard";


            const icon =
                document.createElement(
                    "div"
                );


            icon.className =
                "fileIcon";


            icon.textContent =
                getFileIcon(
                    file.name
                );


            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "fileName";


            name.textContent =
                file.name;


            const info =
                document.createElement(
                    "div"
                );


            info.className =
                "fileInfo";


            info.textContent =
                `${formatSize(file.size)} • ` +
                `${formatDate(file.addedAt)}`;


            const download =
                document.createElement(
                    "a"
                );


            download.className =
                "downloadBtn";


            download.href =
                file.downloadUrl ||
                file.url;


            download.target =
                "_blank";


            download.rel =
                "noopener";


            download.textContent =
                "📥 تحميل";


            card.append(
                icon,
                name,
                info,
                download
            );


            container.appendChild(
                card
            );

        }
    );
}


function setStatus(
    type,
    text
) {

    const dot =
        document.getElementById(
            "statusDot"
        );


    const label =
        document.getElementById(
            "statusText"
        );


    if (type === "online") {

        dot.style.background =
            "#22c55e";

    } else if (type === "loading") {

        dot.style.background =
            "#f59e0b";

    } else {

        dot.style.background =
            "#ef4444";
    }


    label.textContent =
        text;
}


function showNotice(text) {

    const notice =
        document.getElementById(
            "notice"
        );


    notice.textContent =
        text;


    notice.classList.remove(
        "hidden"
    );


    clearTimeout(
        showNotice.timer
    );


    showNotice.timer =
        setTimeout(
            () => {

                notice.classList.add(
                    "hidden"
                );

            },
            4000
        );
}


function formatSize(bytes) {

    if (!bytes) {

        return "حجم غير معروف";
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


function formatDate(date) {

    if (!date) {

        return "بدون تاريخ";
    }


    return new Date(
        date
    ).toLocaleDateString(
        "ar-MA"
    );
}


function getFileIcon(name) {

    const extension =
        String(name)
            .split(".")
            .pop()
            .toLowerCase();


    const icons = {

        apk: "📱",

        zip: "🗜️",
        rar: "🗜️",
        "7z": "🗜️",

        exe: "💻",

        iso: "💿",

        mp4: "🎬",
        mkv: "🎬",
        avi: "🎬",

        mp3: "🎵",

        pdf: "📕",

        jpg: "🖼️",
        jpeg: "🖼️",
        png: "🖼️",
        webp: "🖼️",

        doc: "📝",
        docx: "📝",

        xls: "📊",
        xlsx: "📊"
    };


    return (
        icons[extension] ||
        "📄"
    );
}