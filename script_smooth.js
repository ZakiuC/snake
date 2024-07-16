const GameState = Object.freeze({
    START: "start",
    IN_PROGRESS: "inProgress",
    PAUSED: "paused",
    ENDED: "ended"
});

// 移动方向
const Direction = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
    STOP: { x: 0, y: 0 }
};

class SnakeGame {
    constructor(gameArea, settings) {
        this.gameArea = gameArea;
        this.settings = settings;
        this.gameState = GameState.START;
        this.snake = [];
        this.fruit = { x: -1, y: -1 };
        this.fruitAdd = this.settings.fruitAdd; //
        this.currentDirection = Direction.STOP;
        this.nextDirection = Direction.STOP;
        this.isAccelerating = false; // 跟踪是否加速
        this.accelerationFactor = 2; // 定义加速因子，比如加速时速度是普通的2倍
        this.baseUpdateInterval = this.settings.updateInterval;  // 保存基本间隔
        this.timeRemaining = this.settings.timer; // 初始计时器时间
        this.acceleratedCellsMoved = 0; // 在加速模式下移动的格数计数器
        this.consumed = this.settings.consumed; // 达到减少蛇长度的移动格数阈值
        this.reward = this.settings.reward;
        this.rewardPlus = this.settings.rewardPlus;
        this.score = 0;
        this.lastFrameTimeMs = 0; // 上次帧更新的时间戳
        this.maxFPS = 60; // 最大帧率限制
        this.delta = 0; // 定义delta变量，用于追踪更新时间间隔
    }

    // 初始化游戏棋盘
    initGameBoard() {
        const existingGameOverText = document.getElementById('gameOver');
        if (existingGameOverText) {
            existingGameOverText.remove(); // 如果存在游戏结束文字，先移除
        }

        this.gameArea.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < this.settings.gridSize; i++) {
            for (let j = 0; j < this.settings.gridSize; j++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.setAttribute('data-row', i);
                cell.setAttribute('data-col', j);
                fragment.appendChild(cell);
            }
        }
        this.gameArea.appendChild(fragment);

        // 设置计时器显示初始值
        this.timeRemaining = this.settings.timer;
        document.getElementById('time').textContent = `${this.timeRemaining}s`;

        // 初始化分数
        this.score = 0;
        document.getElementById('score').textContent = `${this.score}`;
    }

    // 获取随机位置的辅助函数
    getRandomPosition(min, max) {
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    // 随机化蛇的初始位置
    randomizeSnakePosition() {
        this.snake = [{
            x: this.getRandomPosition(this.settings.leftTop.x, this.settings.rightBottom.x),
            y: this.getRandomPosition(this.settings.leftTop.y, this.settings.rightBottom.y)
        }];
    }

    // 检查蛇是否在某位置
    isSnakeOnPosition(x, y) {
        return this.snake.some(segment => segment.x === x && segment.y === y);
    }

    // 生成水果的位置
    generateFruit() {
        let availablePositions = [];
        for (let i = 0; i < this.settings.gridSize; i++) {
            for (let j = 0; j < this.settings.gridSize; j++) {
                if (!this.isSnakeOnPosition(i, j)) {
                    availablePositions.push({ x: j, y: i });
                }
            }
        }
        if (availablePositions.length > 0) {
            let randomPos = availablePositions[Math.floor(Math.random() * availablePositions.length)];
            this.fruit = randomPos;
            this.changeCellStyle(this.fruit, "green");
        }
    }

    // 逻辑
    performGameIteration() {
        if(this.gameState != GameState.IN_PROGRESS)
        {
            return;
        }
        if (this.timeRemaining <= 0) {
            this.endGame('time up');
            return;
        }

        // 在每次循环开始时更新方向
        this.currentDirection = this.nextDirection;

        // 计算新的蛇头位置
        let newHead = { x: this.snake[0].x + this.currentDirection.x, y: this.snake[0].y + this.currentDirection.y };
        
        // 更新倒计时
        this.timeRemaining -= this.settings.updateInterval / 1000;
        document.getElementById('time').textContent = `${Math.max(0, Math.round(this.timeRemaining))}s`;

        if (this.isAccelerating) {
            this.acceleratedCellsMoved++;
        }

        if (this.isAccelerating && this.acceleratedCellsMoved >= this.consumed) {
            this.acceleratedCellsMoved = 0;  // 重置计数器
            if (this.snake.length > 1) {
                this.snake.pop();  // 减少蛇的长度
            }
        }

        // 检查新的蛇头位置是否撞墙或出界
        const collisionResult = this.checkCollision(newHead);
        if (collisionResult.collision) {
            this.endGame(`collision with ${collisionResult.type}`);
            return;
        }

        this.updateSnakePosition(newHead);
        this.updateGameArea();
    }

    // 游戏循环
    gameLoop(timestamp) {
        if (timestamp < this.lastFrameTimeMs + (1000 / this.maxFPS)) {
            requestAnimationFrame(this.gameLoop.bind(this));
            return;
        }
        this.delta += timestamp - this.lastFrameTimeMs;
        this.lastFrameTimeMs = timestamp;

        // 控制实际的更新间隔
        let interval = this.baseUpdateInterval;
        if (this.isAccelerating) {
            interval /= this.accelerationFactor; // 加速时减少间隔
        }
        if (this.delta >= interval) {
            this.performGameIteration();
            this.delta -= interval;
        }
        
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    // 碰撞检查
    checkCollision(newHead) {
        if (newHead.x < 0 || newHead.x >= this.settings.gridSize || newHead.y < 0 || newHead.y >= this.settings.gridSize) {
            return { collision: true, type: 'wall' };
        }
        if (this.snake.some((segment, index) => index > 0 && segment.x === newHead.x && segment.y === newHead.y)) {
            return { collision: true, type: 'self' };
        }
        return { collision: false };
    }

    // 更新蛇的位置
    updateSnakePosition(newHead) {
        // 检查是否吃到水果
        if (newHead.x === this.fruit.x && newHead.y === this.fruit.y) {
            this.snake.unshift(newHead);
            for(let i = 0; i < this.fruitAdd - 1; i++)
            {
                this.snake.unshift({x: newHead.x, y: newHead.y});
            }

            // 加分
            if(this.isAccelerating)
            {
                this.score += this.rewardPlus;
            }else{
                this.score += this.reward;
            }
            document.getElementById('score').textContent = `${this.score}`;
            this.generateFruit();
        } else {
            this.snake.unshift(newHead);
            this.snake.pop();
        }
    }

    // 更新游戏区域
    updateGameArea() {
        const cells = this.gameArea.querySelectorAll('.cell').forEach(cell => {
            cell.style.backgroundColor = '#b1a2c7';
            cell.style.transform = 'scale(1)'; // 重置非蛇的格子的缩放
            cell.style.zIndex = '0'; // 重置层级
        });
        this.snake.forEach((segment, index) => {
            // 对蛇的头部应用较大的缩放
            this.changeCellStyle(segment, index === 0 ? "#7A2CBF" : "#a357e6", 1.15);
        });
        this.changeCellStyle(this.fruit, "green", 1.15);
    }

    // 改变特定单元格样式
    changeCellStyle(pos, color, scale = 1) {
        const cell = this.gameArea.querySelector(`.cell[data-row="${pos.y}"][data-col="${pos.x}"]`);
        if (cell) {
            cell.style.backgroundColor = color;
            cell.style.transform = `scale(${scale})`; // 应用缩放
            cell.style.transformOrigin = 'center'; // 确保缩放是以中心为基点
            cell.style.zIndex = scale > 1 ? '10' : '1'; // 确保蛇部分在顶部
        }
    }

    // 结束游戏
    endGame(reason) {
        this.isAccelerating = false;
        this.currentDirection = Direction.STOP;
        this.nextDirection = Direction.STOP;
        // this.gameArea.innerHTML = '<div id="gameOver">Game Over</div>';
        this.gameState = GameState.ENDED;
        // 输出游戏结束的原因和蛇的数据
        console.log(`Game Over due to ${reason}`);
        console.log(`Snake length: ${this.snake.length}`);
        console.log(`Snake position: ${JSON.stringify(this.snake)}`);
    }

    // 处理按键按下事件
    handleKeyDown(event) {
        const keyMap = {
            'arrowup': Direction.UP,
            'w': Direction.UP,
            'arrowdown': Direction.DOWN,
            's': Direction.DOWN,
            'arrowleft': Direction.LEFT,
            'a': Direction.LEFT,
            'arrowright': Direction.RIGHT,
            'd': Direction.RIGHT
        };
        const newDirection = keyMap[event.key.toLowerCase()];
        if (newDirection && this.canChangeDirection(newDirection)) {
            this.nextDirection = newDirection;
        }

        if (event.key === "Shift") {
            this.isAccelerating = true;
        }
    }

    // 处理按键释放事件
    handleKeyUp(event) {
        if (event.key === "Shift") {
            this.isAccelerating = false;
        }
    }

    // 检查是否可以更改方向
    canChangeDirection(newDirection) {
        return !(this.currentDirection.x + newDirection.x === 0 && this.currentDirection.y + newDirection.y === 0);
    }

    startGame() {
        if (this.gameState !== GameState.IN_PROGRESS) {
            this.initGameBoard();
            this.delta = 0; // 从0开始累计间隔时间
            
            this.randomizeSnakePosition();

            this.gameState = GameState.IN_PROGRESS;
            this.generateFruit();
            requestAnimationFrame(this.gameLoop.bind(this));
            console.log('Game start');
        }
    }
}

/*
 * 测试用例，在游戏区域绘制矩形
*/
function drawRectangle(leftTop, rightBottom, color, fill = true) {
    for (let y = leftTop.y; y <= rightBottom.y; y++) {
        for (let x = leftTop.x; x <= rightBottom.x; x++) {
            // 如果填充整个矩形或者仅在边界上时设置颜色
            if (fill || x === leftTop.x || x === rightBottom.x || y === leftTop.y || y === rightBottom.y) {
                const cells = document.querySelectorAll(`.cell[data-row="${y}"][data-col="${x}"]`);
                cells.forEach(cell => {
                    cell.style.backgroundColor = color;
                });
            }
        }
    }
}

const gameArea = document.getElementById('gameArea');
const settings = {
    gridSize: 25, 
    leftTop: { x: 4, y: 4 },
    rightBottom: { x: 20, y: 20 },
    updateInterval: 200,
    timer: 60,  // (s)
    consumed: 10,    // 加速状态下每经过consumed格，蛇身-1
    fruitAdd: 5,     // 吃到一个果子+fruitAdd蛇身
    reward: 1,
    rewardPlus: 2,
};
const snakeGame = new SnakeGame(gameArea, settings);

document.addEventListener('keydown', event => snakeGame.handleKeyDown(event));
document.addEventListener('keyup', event => snakeGame.handleKeyUp(event));
