async function predictIF() {
    const journalName = document.getElementById("journalName").value;
    const resultDiv = document.getElementById("result");
    resultDiv.innerHTML = ""; // 清空之前的结果

    if (!journalName) {
        resultDiv.innerHTML = "<p class='error'>请输入期刊名称</p>";
        return;
    }

    resultDiv.innerHTML = "<p>正在查询...</p>";

    try {
        // 假设我们使用 LetPub 的 API (这只是一个示例，需要根据实际情况调整)
        // 注意：LetPub 的 API 可能会变化，以下代码可能需要根据实际情况修改
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
           resultDiv.innerHTML = "<p class='error'>没有找到该期刊</p>";
           return;
        }

        
        if (!journalTable) {
            resultDiv.innerHTML = "<p class='error'>未找到该期刊或数据获取失败</p>";
            return;
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
           resultDiv.innerHTML = "<p class='error'>没有找到该期刊</p>";
           return;
        }
      
        // 计算影响因子
        const predictedIF = citations2023 / papers2021_2022;

        resultDiv.innerHTML = `<p>预测 ${journalName} 的2024年影响因子为：${predictedIF.toFixed(2)}</p>
                             <p>2023文章在2021和2022的引用: ${citations2023}</p>
                             <p>2021和2022文章: ${papers2021_2022}</p>`;

    } catch (error) {
        console.error("Error fetching data:", error);
        resultDiv.innerHTML = `<p class='error'>数据获取失败: ${error.message}</p>`;
    }
}