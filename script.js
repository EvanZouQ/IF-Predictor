async function getHighImpactJournals() {
    const resultsDiv = document.getElementById("results");
    const progressDiv = document.getElementById("progress");
    resultsDiv.innerHTML = ""; // 清空之前的结果
    progressDiv.innerHTML = "";

    try {
        // 1. 获取期刊列表 (这里是关键，需要一个包含期刊名称的列表)
        //    * 理想情况：从 Web of Science 或 Scopus API 获取 (需要订阅)
        //    * 替代方案：
        //      - 从 LetPub 或其他网站抓取 (需要处理分页、异步请求等)
        //      - 使用一个预先准备好的期刊列表 (例如，一个包含高影响力期刊的 CSV 文件)
        //
        //    这里我们 *假设* 有一个名为 `getJournalList()` 的函数
        //    它返回一个 Promise，该 Promise 解析为一个期刊名称数组
        //    *您需要根据您的实际数据来源实现这个函数*

        const journalList = await getJournalList(); // 假设的函数

        // 2. 循环处理每个期刊
        let processedCount = 0;
        for (const journalName of journalList) {
            // 显示进度
            processedCount++;
            progressDiv.innerHTML = `正在处理 ${processedCount} / ${journalList.length} 个期刊...`;

            // 3. 获取单个期刊的数据并计算影响因子 (与之前的 predictIF() 函数类似)
            try {
                const { citations2023, papers2021_2022 } = await getJournalData(journalName); // 假设的函数

                if (citations2023 === undefined || papers2021_2022 === undefined || papers2021_2022 === 0)
                {
                    throw new Error("数据无效")
                }
                const predictedIF = citations2023 / papers2021_2022;

                // 4. 过滤 IF > 10 的期刊
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
                // 处理单个期刊的错误 (例如，期刊未找到、数据获取失败)
                const errorDiv = document.createElement("div");
                errorDiv.classList.add("journal", "error");
                errorDiv.innerHTML = `${journalName}: 获取数据失败 - ${error.message}`;
                resultsDiv.appendChild(errorDiv);
            }
        }

        progressDiv.innerHTML = "处理完成！";

    } catch (error) {
        // 处理获取期刊列表时的错误
        resultsDiv.innerHTML = `<p class='error'>获取期刊列表失败: ${error.message}</p>`;
    }
}


// 假设的函数：获取期刊列表 (您需要根据实际情况实现)
async function getJournalList() {
     // 示例：从 LetPub 抓取 (需要处理分页，这只是一个非常简化的示例)
    // 注意：LetPub 的网站结构和 API 可能会变化，这只是一个示例，可能需要根据实际情况修改
    let allJournals = [];
    let page = 1;
    const pageSize = 50; // 假设每页 50 个期刊 (需要根据 LetPub 实际情况调整)
    const maxPages = 10;   // 限制最大页数，防止无限循环

    while (page <= maxPages) { // 限制最大页数
        const letpubUrl = `https://www.letpub.com.cn/index.php?page=journalapp&view=search&searchname=&searchissn=&searchfield=&searchimpactlow=&searchimpacthigh=&searchcountry=&searchissnexact=&searchcategory1=&searchcategory2=&searchjcrkind=&searchjcr=&searchsort=if_2022¤tpage=${page}`;
      
        try {
            const response = await fetch(letpubUrl);
           
            const htmlText = await response.text();
            
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, "text/html");
           
            const journalTable = doc.querySelector(".table_yjfx");
             
             if (!journalTable) {
                console.log(`第 ${page} 页未找到期刊列表`);
                break; // 如果找不到表格，可能已经到达最后一页
            }

            const rows = journalTable.querySelectorAll("tr");
            if (rows.length <= 1)
            {
                break;
            }

            for (let i = 1; i < rows.length; i++) {
                const cells = rows[i].querySelectorAll("td");
                const journalName = cells[1].textContent.trim();
                
                allJournals.push(journalName);
             }
             page++;
        
        }
        catch (e)
        {
            break;
        }
    }

    return allJournals;
}

// 假设的函数：获取单个期刊的数据 (您需要根据实际情况实现)
async function getJournalData(journalName) {
    // 示例：从 LetPub 抓取 (这只是一个非常简化的示例)
    const letpubUrl = `https://www.letpub.com.cn/index.php?page=journalapp&view=search&searchname=${encodeURIComponent(journalName)}`;
    const response = await fetch(letpubUrl);
    const htmlText = await response.text();
     // 使用 DOMParser 解析 HTML (更可靠的方式)
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
    // 假设 LetPub 的页面结构如下（需要根据实际情况调整）
    const journalTable = doc.querySelector(".table_yjfx"); // 找到包含期刊信息的表格

     if (!journalTable)
    {
        throw new Error("数据无效")
    }
      // 提取数据 (以下是示例，需要根据 LetPub 实际的 HTML 结构调整)
    let citations2023 = 0; //2023文章在2021和2022的引用
    let papers2021_2022 = 0;//2021和2022文章

    const rows = journalTable.querySelectorAll("tr");
    let found = false;
    for (let i = 1; i < rows.length; i++) { // 从第二行开始，跳过表头
        const cells = rows[i].querySelectorAll("td");
        const name = cells[1].textContent.trim().toLowerCase();
        if (name.includes(journalName.toLowerCase()))
        {
            citations2023 = parseInt(cells[5].textContent.trim()); // 假设第6列是引用
            papers2021_2022 = parseInt(cells[6].textContent.trim()); // 假设第7列是文章数量
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


// 页面加载完成后开始执行
window.onload = getHighImpactJournals;