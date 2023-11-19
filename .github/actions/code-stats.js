const axios = require("axios");
const fs = require("fs");
const moment = require("moment");

async function getUsername() {
  const response = await githubAxios.get("https://api.github.com/user");
  return response.data.login; // 这里 'login' 是用户名
}

const GITHUB_TOKEN =
  "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";
// const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
// 配置 axios 实例
const githubAxios = axios.create({
  baseURL: "https://api.github.com/",
  headers: {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
  },
});

// 获取用户在特定日期范围内的提交事件
async function getUserCommits(username, startDate, endDate) {
  try {
    let page = 1;
    let keepGoing = true;
    let dailyCodeChanges = {};
    console.log('xxxx', username, startDate, endDate)
    while (keepGoing) {
      const response = await githubAxios.get(
        `/users/${username}/events?page=${page}`
      );
      console.log('xxxx', response.data)
      for (let event of response.data) {
        if (event.type === "PushEvent") {
          let eventDate = moment(event.created_at);
          if (eventDate.isBetween(startDate, endDate, "day", "[]")) {
            const dateStr = eventDate.format("YYYY-MM-DD");
            for (let commit of event.payload.commits) {
              const commitData = await githubAxios.get(
                `/repos/${event.repo.name}/commits/${commit.sha}`
              );
              console.log('xxxx', commitData.data)
              const stats = commitData.data.stats;
              console.log('xxxx', stats)
              console.log('xxxx', dailyCodeChanges[dateStr])
              if (!dailyCodeChanges[dateStr]) {
                dailyCodeChanges[dateStr] = { additions: 0, deletions: 0 };
              }
              dailyCodeChanges[dateStr].additions += stats.additions;
              dailyCodeChanges[dateStr].deletions += stats.deletions;
            }
          } else if (eventDate.isBefore(startDate)) {
            keepGoing = false;
            break;
          }
        }
      }

      if (response.data.length === 0 || !keepGoing) {
        break;
      }

      page++;
    }

    return { username, dailyCodeChanges };
  } catch (error) {
    console.error(`Error fetching commits for ${username}:`, error);
    return { username, dailyCodeChanges: {} };
  }
}

// 更新 README.md 的函数
function updateReadme(dailyCodeChanges) {
  const readmePath = "./README.md";
  let readmeContent = "";

  // 尝试读取现有的 README.md 内容
  if (fs.existsSync(readmePath)) {
    readmeContent = fs.readFileSync(readmePath, "utf8");
  }

  // 构建新的统计数据部分
  let statsContent = "## Daily Code Statistics\n\n";
  statsContent += "| Date       | Addition Codes | Deletion Codes |\n";
  statsContent += "|------------|-----------|-----------|\n";

  Object.entries(dailyCodeChanges).forEach(([date, stats]) => {
    statsContent += `| ${date} | ${stats.additions} | ${stats.deletions} |\n`;
  });

  // 标记统计数据的开始和结束
  const startMarker = "<!-- START_STATS -->";
  const endMarker = "<!-- END_STATS -->";

  // 替换旧的统计数据
  const start = readmeContent.indexOf(startMarker);
  const end = readmeContent.indexOf(endMarker);

  if (start !== -1 && end !== -1) {
    readmeContent =
      readmeContent.substring(0, start + startMarker.length) +
      "\n\n" +
      statsContent +
      "\n" +
      readmeContent.substring(end);
  } else {
    // 如果未找到标记，则在文件末尾追加统计数据
    readmeContent +=
      "\n" + startMarker + "\n\n" + statsContent + "\n" + endMarker;
  }

  // 写入更新后的内容
  fs.writeFileSync(readmePath, readmeContent, "utf8");
}

// 主函数
async function main() {

  // const user = await getUsername()
  const START_DATE =  moment().subtract(1, 'days').format('YYYY-MM-DD');
  const END_DATE = moment().subtract(1, 'days').format('YYYY-MM-DD');
  console.log('START_DATE', START_DATE)
  console.log('END_DATE', END_DATE)
  const userCommits = await getUserCommits(user, START_DATE, END_DATE);
  console.log('xxxx', userCommits)
  // 格式化输出并更新 README.md
  updateReadme(userCommits);
}

main();
