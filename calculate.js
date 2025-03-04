async function getHighImpactJournals() {
    const resultsDiv = document.getElementById("results");
    const progressDiv = document.getElementById("progress");
    resultsDiv.innerHTML = ""; // 清空之前的结果
    progressDiv.innerHTML = "";

    try {
        const journalList = await getJournalList();
        console.log("期刊列表:", journalList); // 调试：输出期刊列表

        let processedCount = 0;
        for (const journalName of journalList) {
            processedCount++;
            progressDiv.innerHTML = `正在处理 ${processedCount} / ${journalList.length} 个期刊...`;

            try {
                const { citations2023, papers2021_2022 } = await getJournalData(journalName);

                if (citations2023 === undefined || papers2021_2022 === undefined || papers2021_2022 === 0) {
                    throw new Error("数据无效");
                }

                const predictedIF = citations2023 / papers2021_2022;

                if (predictedIF > 10) {
                    const journalDiv = document.createElement("div");
                    journalDiv.classList.add("journal");
                    journalDiv.innerHTML = `
                        <span class="journal-name">${journalName}</span>: 
                        <span class="predicted-if">${predictedIF.toFixed(2)}</span>
                        (引用: ${citations2023}, 文章: ${papers2021_2022})
                    `;
                    resultsDiv.appendChild(journalDiv);
                }
            } catch (error) {
                const errorDiv = document.createElement("div");
                errorDiv.classList.add("journal", "error");
                errorDiv.innerHTML = `${journalName}: 获取数据失败 - ${error.message}`;
                resultsDiv.appendChild(errorDiv);
            }
        }

        progressDiv.innerHTML = "处理完成！";

    } catch (error) {
        resultsDiv.innerHTML = `<p class='error'>获取期刊列表失败: ${error.message}</p>`;
    }
}

// 延时函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 获取期刊列表 (改进版，添加调试信息)
async function getJournalList() {
    let allJournals = [];
    let page = 1;
    const pageSize = 50;
    const maxPages = 10;

    while (page <= maxPages) {
        const letpubUrl = `https://www.letpub.com.cn/index.php?page=journalapp&view=search&searchname=&searchissn=&searchfield=&searchimpactlow=&searchimpacthigh=&searchcountry=&searchissnexact=&searchcategory1=&searchcategory2=&searchjcrkind=&searchjcr=&searchsort=if_2022¤tpage=${page}`;
        console.log(`正在请求第 ${page} 页: ${letpubUrl}`); // 调试

        try {
            const response = await fetch(letpubUrl);
            console.log(`第 ${page} 页响应状态: ${response.status}`); // 调试

            if (response.status !== 200) {
                console.error(`第 ${page} 页请求失败: ${response.status}`);
                break;
            }

            const htmlText = await response.text();
            //console.log(`第 ${page} 页 HTML:`, htmlText); // 调试 (谨慎使用，HTML 可能很长)

            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, "text/html");

            const journalTable = doc.querySelector(".table_yjfx");
            if (!journalTable) {
                console.log(`第 ${page} 页未找到期刊列表`);
                break;
            }

            const rows = journalTable.querySelectorAll("tr");
            console.log(`第 ${page} 页找到 ${rows.length} 行`); // 调试
            if (rows.length <= 1) {
                break;
            }

            for (let i = 1; i < rows.length; i++) {
                const cells = rows[i].querySelectorAll("td");
                const journalName = cells[1].textContent.trim();
                allJournals.push(journalName);
                console.log(`第 ${page} 页, 期刊 ${i}: ${journalName}`); // 调试
            }

            page++;
            await sleep(1000); // 延迟 1 秒，防止请求过快

        } catch (error) {
            console.error(`第 ${page} 页出错:`, error);
            break; // 如果出错，停止循环
        }
    }

    return allJournals;
}

// 获取单个期刊数据 (改进版，添加调试信息)
async function getJournalData(journalName) {
    const letpubUrl = `https://www.letpub.com.cn/index.php?page=journalapp&view=search&searchname=${encodeURIComponent(journalName)}`;
    console.log(`正在请求期刊: ${letpubUrl}`); // 调试

    const response = await fetch(letpubUrl);
    console.log(`期刊 ${journalName} 响应状态: ${response.status}`); // 调试

    if (response.status !== 200) {
        throw new Error(`请求失败: ${response.status}`);
    }

    const htmlText = await response.text();
    //console.log(`期刊 ${journalName} HTML:`, htmlText); // 调试 (谨慎使用)

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    const journalTable = doc.querySelector(".table_yjfx");
    if (!journalTable) {
        throw new Error("未找到期刊表格");
    }

    let citations2023 = 0;
    let papers2021_2022 = 0;
    const rows = journalTable.querySelectorAll("tr");
       let found = false;
    for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll("td");
        const name = cells[1].textContent.trim().toLowerCase();

        if (name.includes(journalName.toLowerCase())) {
                citations2023 = parseInt(cells[5].textContent.trim());
                papers2021_2022 = parseInt(cells[6].textContent.trim());
                console.log(`期刊 ${journalName} 数据: 引用=${citations2023}, 文章=${papers2021_2022}`); // 调试
              	found = true;
                break;
        }

    }
     if(!found)
    {
        throw new Error("数据无效")
    }


    return { citations2023, papers2021_2022 };
}

window.onload = getHighImpactJournals;
