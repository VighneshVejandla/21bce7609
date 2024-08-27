// working main
import React, { useEffect, useState } from 'react';
import "./Chess.css";

const ChessGame = () => {
    const BOARD_SIZE = 5;

    const [roomId, setRoomId] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [gameState, setGameState] = useState({
        board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null)),
        currentPlayer: 'A',
        message: ''
    });
    const [selectedCharacter, setSelectedCharacter] = useState(null);
    const [moveHistory, setMoveHistory] = useState([]);
    const [playerId, setPlayerId] = useState(null); 
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        if (roomId) {
            const ws = new WebSocket(`ws://localhost:8081?roomId=${roomId}`);
            setSocket(ws);

            ws.onopen = () => {
                console.log(`WebSocket connection established for room ID: ${roomId}`);
                setIsConnected(true);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('Received message:', data);

                if (data.type === 'boardState') {
                    console.log('Updating board state:', data.boardState);
                    setGameState(prevState => ({
                        ...prevState,
                        board: data.boardState,
                        currentPlayer: data.currentPlayer
                    }));
                } else if (data.type === 'move') {
                    console.log(`Player ${data.currentPlayer} moved ${data.character} from (${data.fromX}, ${data.fromY}) to (${data.toX}, ${data.toY})`);
                    setGameState(prevState => ({
                        ...prevState,
                        board: data.boardState,
                        currentPlayer: data.currentPlayer,
                        message: ''  // Clear any error messages
                    }));

                    const fromLabel = getLabelForPosition(data.fromX, data.fromY);
                    const toLabel = getLabelForPosition(data.toX, data.toY);
                    setMoveHistory(prevHistory => [
                        ...prevHistory,
                        `Player ${gameState.currentPlayer} moved ${data.character} from ${fromLabel} to ${toLabel}`
                    ]);
                } else if (data.error) {
                    console.error('Error from server:', data.error);
                    setGameState(prevState => ({
                        ...prevState,
                        message: data.error
                    }));
                }
            };

            ws.onclose = () => {
                console.log(`WebSocket connection closed for room ID: ${roomId}`);
                setIsConnected(false);
            };

            return () => {
                ws.close();
            };
        }
    }, [roomId]);

    const getCellClass = (cell) => {
        if (cell) {
            const type = cell.slice(1);
            switch (type) {
                case 'P1':
                case 'P2':
                case 'P3':
                    return 'pawn';
                case 'H1':
                    return 'hero1';
                case 'H2':
                    return 'hero2';
                default:
                    return '';
            }
        }
        return '';
    };

    const isValidMove = (character, fromX, fromY, toX, toY) => {
        const deltaX = Math.abs(toX - fromX);
        const deltaY = Math.abs(toY - fromY);

        switch (character.slice(1)) {
            case 'P1':
            case 'P2':
            case 'P3':
                return (deltaX === 1 && deltaY === 0) || (deltaX === 0 && deltaY === 1);
            case 'H1':
                return (deltaX === 2 && deltaY === 0) || (deltaX === 0 && deltaY === 2);
            case 'H2':
                return deltaX === 1 && deltaY === 1;
            default:
                return false;
        }
    };

    const getLabelForPosition = (x, y) => {
        const rowLabel = String.fromCharCode('A'.charCodeAt(0) + x);
        const colLabel = (y + 1).toString();
        return `${rowLabel}${colLabel}`;
    };

    const handleCellClick = (x, y) => {
        const character = gameState.board[x][y];
    
        if (selectedCharacter) {
            const [fromX, fromY] = findCharacterPosition(selectedCharacter, gameState.board);
    
            if (isValidMove(selectedCharacter, fromX, fromY, x, y)) {
                const targetCell = gameState.board[x][y];
                const targetPlayer = targetCell ? targetCell.charAt(0) : null;
    
                if (targetPlayer === null || targetPlayer !== gameState.currentPlayer) {
                    const newBoard = gameState.board.map(row => row.slice());
    
                    newBoard[fromX][fromY] = null;
                    newBoard[x][y] = selectedCharacter;
    
                    const fromLabel = getLabelForPosition(fromX, fromY);
                    const toLabel = getLabelForPosition(x, y);
    
                    // Send move to the server
                    if (socket) {
                        console.log(`Sending move to server: ${selectedCharacter} from (${fromX}, ${fromY}) to (${x}, ${y})`);
                        socket.send(JSON.stringify({
                            type: 'move',
                            character: selectedCharacter,
                            fromX,
                            fromY,
                            toX: x,
                            toY: y,
                            boardState: newBoard,
                            currentPlayer: gameState.currentPlayer
                        }));
                    }
    
                    setGameState(prevState => ({
                        ...prevState,
                        board: newBoard,
                        currentPlayer: prevState.currentPlayer === 'A' ? 'B' : 'A',
                        message: ''
                    }));
    
                    setSelectedCharacter(null);
                } else {
                    setGameState(prevState => ({
                        ...prevState,
                        message: `Hey, you can't move to the occupied cell of your own`,
                        messageType: 'occupied-message'
                    }));
                }
            } else {
                setGameState(prevState => ({
                    ...prevState,
                    message: `Nahh.. you made a wrong move for ${selectedCharacter}`,
                    messageType: 'wrong-move-message'
                }));
            }
        } else if (character && character.startsWith(gameState.currentPlayer)) {
            setSelectedCharacter(character);
            console.log(`Selected character: ${character} at position (${x}, ${y})`);
            setGameState(prevState => ({
                ...prevState,
                message: ''
            }));
        } else {
            setGameState(prevState => ({
                ...prevState,
                message: 'It\'s not your turn'
            }));
        }
    };

    const findCharacterPosition = (character, board) => {
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (board[i][j] === character) {
                    return [i, j];
                }
            }
        }
        return null;
    };

    const BoardCell = React.memo(({ cell, rowIndex, cellIndex }) => (
        <div
            className={`board-cell ${getCellClass(cell)}`}
            onClick={() => handleCellClick(rowIndex, cellIndex)}
        >
            {cell ? cell : ""}
        </div>
    ));

    const handleCreateRoom = () => {
        const newRoomId = (Math.floor(Math.random() * 100000) + 1).toString();
        setRoomId(newRoomId);
        console.log(`Created room with ID: ${newRoomId}`);
    };

    return (
        
<div className="main-container">

<div className="game-guide">
    <h2>Game Rules</h2>
    
    <h3>Game Setup</h3>
    <ul>
        <li>The game is played between two players on a 5x5 grid.</li>
        <li>Each player controls a team of 5 characters, which can include Pawns, Hero1, and Hero2.</li>
        <li>Players arrange their characters on their respective starting rows at the beginning of the game.</li>
    </ul>
    
    <h3>Characters and Movement</h3>
    <ul>
        <li><strong>Pawn:</strong>
            <ul>
                <li>Moves one block in any direction (Left, Right, Forward, or Backward).</li>
                <li>Move commands: L (Left), R (Right), F (Forward), B (Backward)</li>
            </ul>
        </li>
        <li><strong>Hero1:</strong>
            <ul>
                <li>Moves two blocks straight in any direction.</li>
                <li>Kills any opponent's character in its path.</li>
                <li>Move commands: L (Left), R (Right), F (Forward), B (Backward)</li>
            </ul>
        </li>
        <li><strong>Hero2:</strong>
            <ul>
                <li>Moves two blocks diagonally in any direction.</li>
                <li>Kills any opponent's character in its path.</li>
                <li>Move commands: FL (Forward-Left), FR (Forward-Right), BL (Backward-Left), BR (Backward-Right)</li>
            </ul>
        </li>
        <li>All moves are relative to the player's perspective.</li>
    </ul>
</div>

<div className="game-container">
    <h1>Turn-based <br />Chess-like Game</h1>
    
    <div>
        <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
        />
        <button onClick={handleCreateRoom} disabled={isConnected}>Create Room</button>
    </div>

    <div className="player-turn">
        <p>Player's Turn: {gameState.currentPlayer}</p>
    </div>

    {isConnected ? (
        <div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginRight: '10px' }}>
                    {['1', '2', '3', '4', '5'].map(label => (
                        <div key={label} style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{label}</div>
                    ))}
                </div>

                <div id="game-board">
                    {gameState.board.map((row, rowIndex) => (
                        <div key={rowIndex} className="board-row">
                            {row.map((cell, cellIndex) => (
                                <BoardCell
                                    key={cellIndex}
                                    cell={cell}
                                    rowIndex={rowIndex}
                                    cellIndex={cellIndex}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                {['A', 'B', 'C', 'D', 'E'].map(label => (
                    <div key={label} style={{ width: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{label}</div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                <div style={{ textAlign: 'center' }}>
                    {gameState.message && (
                        <p className={gameState.messageType}>{gameState.message}</p>
                    )}
                    <h2>Move History</h2>
                    <div className="move-history-box">
                        {moveHistory.map((move, index) => (
                            <p key={index} className="move-entry">{move}</p>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    ) : (
        <div>Connecting...</div>
    )}
</div>

</div>


    );
};

export default ChessGame;