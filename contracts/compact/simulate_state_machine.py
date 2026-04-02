from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class TaskPhase(str, Enum):
    UNINITIALIZED = "UNINITIALIZED"
    OPEN = "OPEN"
    ASSIGNED = "ASSIGNED"
    SUBMITTED = "SUBMITTED"
    SETTLED = "SETTLED"
    DISPUTED = "DISPUTED"
    CANCELLED = "CANCELLED"


@dataclass
class NightShiftTaskEscrowMachine:
    phase: TaskPhase = TaskPhase.UNINITIALIZED
    sequence: int = 1
    owner_key: str = "nightshift:none:owner"
    worker_key: str = "nightshift:none:worker"
    task_commitment: str = "nightshift:none:task"
    reward_commitment: str = "nightshift:none:reward"
    winning_bid_commitment: str = "nightshift:none:bid"
    receipt_commitment: str = "nightshift:none:receipt"
    events: list[str] = field(default_factory=list)

    def _bump(self, event: str) -> None:
        self.sequence += 1
        self.events.append(event)

    def create_task(self, owner_key: str, task_commitment: str, reward_commitment: str) -> None:
        if self.phase not in {TaskPhase.UNINITIALIZED, TaskPhase.CANCELLED}:
            raise ValueError("task already initialized")
        self.owner_key = owner_key
        self.worker_key = "nightshift:none:worker"
        self.task_commitment = task_commitment
        self.reward_commitment = reward_commitment
        self.winning_bid_commitment = "nightshift:none:bid"
        self.receipt_commitment = "nightshift:none:receipt"
        self.phase = TaskPhase.OPEN
        self._bump("create_task")

    def select_bid(self, caller: str, bid_commitment: str, worker_key: str) -> None:
        if self.phase != TaskPhase.OPEN:
            raise ValueError("task is not open")
        if caller != self.owner_key:
            raise PermissionError("only owner can select a bid")
        self.winning_bid_commitment = bid_commitment
        self.worker_key = worker_key
        self.receipt_commitment = "nightshift:none:receipt"
        self.phase = TaskPhase.ASSIGNED
        self._bump("select_bid")

    def submit_receipt(self, caller: str, receipt_commitment: str) -> None:
        if self.phase != TaskPhase.ASSIGNED:
            raise ValueError("task is not assigned")
        if caller != self.worker_key:
            raise PermissionError("only selected worker can submit receipt")
        self.receipt_commitment = receipt_commitment
        self.phase = TaskPhase.SUBMITTED
        self._bump("submit_receipt")

    def accept_and_settle(self, caller: str) -> None:
        if self.phase != TaskPhase.SUBMITTED:
            raise ValueError("receipt is not submitted")
        if caller != self.owner_key:
            raise PermissionError("only owner can settle")
        self.phase = TaskPhase.SETTLED
        self._bump("accept_and_settle")

    def raise_dispute(self, caller: str) -> None:
        if caller not in {self.owner_key, self.worker_key}:
            raise PermissionError("only owner or worker can dispute")
        if self.phase not in {TaskPhase.ASSIGNED, TaskPhase.SUBMITTED}:
            raise ValueError("dispute not available")
        self.phase = TaskPhase.DISPUTED
        self._bump("raise_dispute")

    def cancel_open_task(self, caller: str) -> None:
        if self.phase != TaskPhase.OPEN:
            raise ValueError("cancel not available")
        if caller != self.owner_key:
            raise PermissionError("only owner can cancel")
        self.phase = TaskPhase.CANCELLED
        self.worker_key = "nightshift:none:worker"
        self.winning_bid_commitment = "nightshift:none:bid"
        self.receipt_commitment = "nightshift:none:receipt"
        self._bump("cancel_open_task")


def assert_raises(fn, exc_type):
    try:
        fn()
    except exc_type:
        return
    raise AssertionError(f"expected {exc_type.__name__}")


def run_happy_path() -> None:
    machine = NightShiftTaskEscrowMachine()
    machine.create_task("owner:key", "task:commit", "reward:commit")
    machine.select_bid("owner:key", "bid:commit", "worker:key")
    machine.submit_receipt("worker:key", "receipt:commit")
    machine.accept_and_settle("owner:key")

    assert machine.phase == TaskPhase.SETTLED
    assert machine.receipt_commitment == "receipt:commit"
    assert machine.events == [
        "create_task",
        "select_bid",
        "submit_receipt",
        "accept_and_settle",
    ]


def run_dispute_path() -> None:
    machine = NightShiftTaskEscrowMachine()
    machine.create_task("owner:key", "task:commit", "reward:commit")
    machine.select_bid("owner:key", "bid:commit", "worker:key")
    machine.raise_dispute("worker:key")
    assert machine.phase == TaskPhase.DISPUTED


def run_invalid_transitions() -> None:
    machine = NightShiftTaskEscrowMachine()
    assert_raises(lambda: machine.select_bid("owner:key", "bid", "worker:key"), ValueError)

    machine.create_task("owner:key", "task:commit", "reward:commit")
    assert_raises(lambda: machine.select_bid("intruder:key", "bid:commit", "worker:key"), PermissionError)
    assert_raises(lambda: machine.submit_receipt("worker:key", "receipt:commit"), ValueError)

    machine.select_bid("owner:key", "bid:commit", "worker:key")
    assert_raises(lambda: machine.submit_receipt("intruder:key", "receipt:commit"), PermissionError)

    machine.submit_receipt("worker:key", "receipt:commit")
    assert_raises(lambda: machine.cancel_open_task("owner:key"), ValueError)


def main() -> None:
    run_happy_path()
    run_dispute_path()
    run_invalid_transitions()
    print("NightShiftTaskEscrow state-machine simulation passed")


if __name__ == "__main__":
    main()
