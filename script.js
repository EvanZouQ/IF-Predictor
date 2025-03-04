// 1. 全局变量和配置
const wosApiKey = "您的WoS API密钥"; // 替换为您的实际密钥
const wosApiBaseUrl = "https://api.clarivate.com/api/wos"; // WoS API 的基础 URL (可能会根据版本变化)
//其他检索字段
//  TC: 被引次数
//  PY: 出版年
//  DT: 文档类型
//  SO：期刊名称
//  TI：标题

// 2. 辅助函数

// 延时函数 (用于限制请求速率)
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 发送 WoS API 请求的函数
async function fetchWosApi(endpoint, params) {
    const url = new URL(endpoint, wosApiBaseUrl);
    url.search = new URLSearchParams(params).toString();

    const headers = {
        "X-APIKey": wosApiKey,
        "Accept": "application/json" // 指定返回 JSON 格式数据
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WoS API 请求失败: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

// 3. 获取期刊列表的函数 (示例：获取 IF > 10 的期刊)
//    您可以根据需要修改此函数，例如，获取特定学科领域的期刊
async function getJournalList() {
    // WoS API 没有直接提供 "IF > 10" 的筛选方式
    // 您需要先获取一个期刊列表，然后在本地进行筛选
    // 或者，如果您已经有一个高影响力期刊的列表，可以直接使用

    // 示例：获取所有期刊 (这可能需要很长时间，并且可能超出 API 的使用限制)
    //       更好的方法是按学科领域分批获取
    //       您需要根据 WoS API 文档调整查询参数
    const journals = [];
    let cursor = ""; // 用于分页的游标

    do {
        const params = {
            databaseId: 'WOS', // 核心合集
            // q: 'SO=(Nature OR Science OR Cell)',  // 示例：搜索特定期刊 (如果需要)
            q: `PY=2023`, // 示例：搜索 2023 年出版的
            limit: 100,     // 每页最多 100 条记录 (最大值)
            cursor: cursor,
            sortField: 'PY+D' //按出版年排序
        };
        

        try {
            const data = await fetchWosApi("/search", params);
            //console.log(data);
             for (const record of data.Data.Records.records) {
                if (record.static_data &&
                    record.static_data.summary &&
                    record.static_data.summary.names &&
                    record.static_data.summary.names.name
                    )
                {
                  
                    let journal = "";
                     for (let i = 0; i < record.static_data.summary.names.name.length; i++)
                    {
                         if (record.static_data.summary.names.name[i].role == "source")
                        {
                            journal = record.static_data.summary.names.name[i].display_name;
                            break;
                        }
                    }
                    if (journal != "" && !journals.includes(journal))
                    {
                         journals.push(journal);
                    }
                }
            }

            cursor = data.CursorMark; // 获取下一页的游标
            console.log(`已获取 ${journals.length} 个期刊`);

             await sleep(1000); // 限制请求速率 (根据 API 使用限制调整)

        } catch (error) {
            console.error("获取期刊列表出错:", error);
            // 可以选择重试或跳过
            break;
        }
    } while (cursor);

    return journals;
}

// 4. 获取单个期刊数据的函数
async function getJournalData(journalName) {
    // 获取 2021 年和 2022 年发表的文章总数
    const papersParams = {
        databaseId: 'WOS',
        q: `SO=${journalName} AND PY=(2021 OR 2022) AND DT=(Article OR Review)`, // 仅统计 Article 和 Review
        limit: 1, // 我们只需要知道总数，不需要具体文章
        fields: 'static_data',
    };
    const papersData = await fetchWosApi("/search", papersParams);
    const papers2021_2022 = papersData.QueryResult.RecordsFound;

    // 获取 2023 年发表的文章在 2021 年和 2022 年被引用的次数
    const citationsParams = {
        databaseId: 'WOS', // 核心合集
        q: `SO=${journalName} AND PY=2023`,
        limit: 1, // 只需要知道总数
        fields: 'static_data', // 只需要返回影响因子的数据
    };
   
    const citationsData = await fetchWosApi("/search", citationsParams);
    const records = citationsData.Data.Records.records;
    let citations2023 = 0;
    for(let i = 0; i < records.length; i++)
    {
        let cites_times = records[i].dynamic_data.citation_related.tc_list.silo_tc.local_count;
        citations2023 += cites_times;
    }

    await sleep(500); // 限制请求速率

    return { citations2023, papers2021_2022 };
}

// 5. 主函数
async function getHighImpactJournals() {
    const resultsDiv = document.getElementById("results");
    const progressDiv = document.getElementById("progress");
    resultsDiv.innerHTML = "";
    progressDiv.innerHTML = "";

    try {
        const journalList = await getJournalList();
        console.log("期刊列表:", journalList);

        let processedCount = 0;
        for (const journalName of journalList) {
            processedCount++;
            progressDiv.innerHTML = `正在处理 ${processedCount} / ${journalList.length} 个期刊...`;

            try {
                const { citations2023, papers2021_2022 } = await getJournalData(journalName);
                 console.log(`期刊 ${journalName} 数据: 引用=${citations2023}, 文章=${papers2021_2022}`); // 调试

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

// 页面加载完成后开始执行
window.onload = getHighImpactJournals;
