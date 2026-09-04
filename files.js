import { list } from "@vercel/blob";


export default async function handler(
    req,
    res
) {

    if (req.method !== "GET") {

        return res
            .status(405)
            .json({
                ok: false,
                error: "Method not allowed"
            });
    }


    try {

        let allBlobs = [];

        let cursor = undefined;


        do {

            const result =
                await list({
                    prefix: "filebox/",
                    limit: 1000,
                    cursor
                });


            allBlobs =
                allBlobs.concat(
                    result.blobs
                );


            cursor =
                result.hasMore
                    ? result.cursor
                    : undefined;

        } while (cursor);


        const files =
            allBlobs
                .map(
                    blob => {

                        const filename =
                            extractFilename(
                                blob.pathname
                            );


                        return {

                            id:
                                extractKey(
                                    blob.pathname
                                ),

                            name:
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
                )
                .sort(
                    (a, b) =>
                        new Date(b.addedAt) -
                        new Date(a.addedAt)
                );


        return res
            .status(200)
            .json({
                ok: true,
                files
            });


    } catch (error) {

        console.error(error);


        return res
            .status(500)
            .json({
                ok: false,
                error:
                    "تعذر جلب الملفات"
            });
    }
}


function extractKey(pathname) {

    const filename =
        pathname.split("/").pop();


    return filename.split(
        "__"
    )[0];
}


function extractFilename(pathname) {

    const filename =
        pathname.split("/").pop();


    const parts =
        filename.split(
            "__"
        );


    if (parts.length < 2) {

        return filename;
    }


    try {

        return decodeURIComponent(
            parts
                .slice(1)
                .join("__")
        );

    } catch {

        return parts
            .slice(1)
            .join("__");
    }
}