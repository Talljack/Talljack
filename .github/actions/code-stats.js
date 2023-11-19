const fs = require("fs");
const { Octokit, App } = require("octokit");
const moment = require("moment");

const octokit = new Octokit({
  auth: process.env.TOKEN,
});

// 获取用户在特定日期范围内的提交事件
async function getUserCommits(username, startDate, endDate) {
  try {
    let page = 1;
    let keepGoing = true;
    let dailyCodeChanges = {};
    console.log('xxxx', username, startDate, endDate)
    while (keepGoing) {
      const response = await octokit.request('GET /users/{username}/events', {
        username,
        page
      })
      for (let event of response.data) {
        if (event.type === "PushEvent") {
          let eventDate = moment(event.created_at);
          if (eventDate.isBetween(startDate, endDate, "day", "[]")) {
            const dateStr = eventDate.format("YYYY-MM-DD");
            for (let commit of event.payload.commits) {
              const commitData = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
                owner: event.repo.name.split('/')[0],
                repo: event.repo.name.split('/')[1],
                ref: commit.sha
              })
              const stats = commitData.data.stats;
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
function updateReadme(dailyInfo) {
  const readmePath = "README.md";
  let readmeContent = "";

  // 尝试读取现有的 README.md 内容
  if (fs.existsSync(readmePath)) {
    // readmeContent = fs.readFileSync(readmePath, "utf8");
    readmeContent = fs.readFileSync(readmePath, "utf8")
  }
  console.log('readmeContent', readmeContent)
  // 构建新的统计数据部分
  let statsContent = `## ${dailyInfo.username} Daily Code Statistics\n\n`;
  statsContent += "| Date       | Addition Codes | Deletion Codes |\n";
  statsContent += "|------------|-----------|-----------|\n";

  Object.entries(dailyInfo.dailyCodeChanges).forEach(([date, stats]) => {
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
  console.log('readmeContent11111', readmeContent)
  // 写入更新后的内容
  fs.writeFileSync(readmePath, readmeContent, "utf8");
}

// 主函数
async function main() {
  const user = process.env.GITHUB_ACTOR;
  const START_DATE =  moment().subtract(1, 'days').format('YYYY-MM-DD');
  const END_DATE = moment().subtract(1, 'days').format('YYYY-MM-DD');
  const userCommits = await getUserCommits(user, START_DATE, END_DATE);
  console.log('results', userCommits)
  // 格式化输出并更新 README.md
  updateReadme();
}

main();
