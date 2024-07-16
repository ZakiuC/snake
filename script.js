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
        this.gameInterval = null;
        this.currentInterval = null;
        this.shiftPressed = false;  // 跟踪 Shift 键的状态
        this.baseUpdateInterval = this.settings.updateInterval;  // 保存基本间隔
        this.timeRemaining = this.settings.timer; // 初始计时器时间
        this.acceleratedCellsMoved = 0; // 在加速模式下移动的格数计数器
        this.consumed = this.settings.consumed; // 达到减少蛇长度的移动格数阈值
        this.reward = this.settings.reward;
        this.rewardPlus = this.settings.rewardPlus;
        this.score = 0;
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
        if (this.timeRemaining <= 0) {
            this.endGame();
            return;
        }

        // 在每次循环开始时更新方向
        this.currentDirection = this.nextDirection;

        // 计算新的蛇头位置
        let newHead = { x: this.snake[0].x + this.currentDirection.x, y: this.snake[0].y + this.currentDirection.y };
        
        // 更新倒计时
        this.timeRemaining -= this.settings.updateInterval / 1000;
        document.getElementById('time').textContent = `${Math.max(0, Math.round(this.timeRemaining))}s`;

        if (this.shiftPressed) {
            this.acceleratedCellsMoved++;
        }

        if (this.shiftPressed && this.acceleratedCellsMoved >= this.consumed) {
            this.acceleratedCellsMoved = 0;  // 重置计数器
            if (this.snake.length > 1) {
                this.snake.pop();  // 减少蛇的长度
            }
        }

        // 检查新的蛇头位置是否撞墙或出界
        if (this.checkCollision(newHead)) {
            this.endGame();
            return;
        }

        this.updateSnakePosition(newHead);
        this.updateGameArea();
    }

    // 游戏循环
    gameLoop() {
        const interval = this.shiftPressed ? this.baseUpdateInterval / 2 : this.baseUpdateInterval;

        if (this.gameInterval === null || this.currentInterval !== interval) {
            clearInterval(this.gameInterval);
            this.gameInterval = setInterval(() => {
                this.performGameIteration();
            }, interval);
            this.currentInterval = interval;
        }
    }

    // 碰撞检查
    checkCollision(newHead) {
        return newHead.x < 0 || newHead.x >= this.settings.gridSize ||
               newHead.y < 0 || newHead.y >= this.settings.gridSize ||
               this.snake.some((segment, index) => index > 0 && segment.x === newHead.x && segment.y === newHead.y);
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
            if(this.shiftPressed)
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
        const cells = this.gameArea.querySelectorAll('.cell').forEach(cell => cell.style.backgroundColor = '#b1a2c7');
        this.snake.forEach((segment, index) => {
            this.changeCellStyle(segment, index === 0 ? "#7A2CBF" : "#a357e6");
        });
        this.changeCellStyle(this.fruit, "green");
    }

    // 改变特定单元格样式
    changeCellStyle(pos, color) {
        const cell = this.gameArea.querySelector(`.cell[data-row="${pos.y}"][data-col="${pos.x}"]`);
        if (cell) {
            cell.style.backgroundColor = color;
        }
    }

    // 结束游戏
    endGame() {
        clearInterval(this.gameInterval);
        this.gameInterval = null;
        this.currentInterval = null;   
        this.currentDirection = Direction.STOP;
        this.nextDirection = Direction.STOP;
        this.gameArea.innerHTML = '<div id="gameOver">Game Over</div>';
        document.getElementById('time').textContent = (this.settings.timer.toString() + 's'); // 重置计时器
        document.getElementById('score').textContent = `${this.score}`;
        this.gameState = GameState.ENDED;
        console.log('Game over');
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
            this.shiftPressed = true;
            this.gameLoop();  // 调整游戏循环的计时
        }
    }

    // 处理按键释放事件
    handleKeyUp(event) {
        if (event.key === "Shift") {
            this.shiftPressed = false;
            this.gameLoop();  // 再次调整游戏循环的计时
        }
    }

    // 检查是否可以更改方向
    canChangeDirection(newDirection) {
        return !(this.currentDirection.x + newDirection.x === 0 && this.currentDirection.y + newDirection.y === 0);
    }
    // canChangeDirection(newDirection) {
    //     return (this.currentDirection == Direction.UP && newDirection != Direction.DOWN ||
    //         this.currentDirection == Direction.DOWN && newDirection != Direction.UP ||
    //         this.currentDirection == Direction.LEFT && newDirection != Direction.RIGHT ||
    //         this.currentDirection == Direction.RIGHT && newDirection != Direction.LEFT ||
    //         this.currentDirection == Direction.STOP);
    // }

    startGame() {
        if (this.gameState !== GameState.IN_PROGRESS) {
            this.initGameBoard();

            this.randomizeSnakePosition();

            this.gameState = GameState.IN_PROGRESS;
            this.generateFruit();
            this.gameLoop();
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
